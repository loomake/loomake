# PROBE（使い捨て・マージしない）：環境変数の印で対象の子孫を識別し、同じハンドルで止める後片付けを、PowerShell 1 回で試す
# 入力は環境変数 LOOMAKE_PROBE_INPUT の JSON：{ mark, targetPid, fromMs, slackMs, limitMs, api: 'emit'|'addtype', terminate: bool, maxPasses }
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$clock = [Diagnostics.Stopwatch]::StartNew()
$in = $env:LOOMAKE_PROBE_INPUT | ConvertFrom-Json
$timing = [ordered]@{}
function Left { [Math]::Max(0, [double]$in.limitMs - $clock.Elapsed.TotalMilliseconds) }
function Emit($obj) { [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 5)) }

$env64 = [Environment]::Is64BitProcess
$os64 = [Environment]::Is64BitOperatingSystem
$arch = $env:PROCESSOR_ARCHITECTURE
Emit ([ordered]@{ kind = 'env'; ps64 = $env64; os64 = $os64; arch = $arch; os = [Environment]::OSVersion.VersionString; psVersion = $PSVersionTable.PSVersion.ToString(); clr = [Environment]::Version.ToString() })
if (-not $env64 -or -not $os64 -or $arch -ne 'AMD64') {
  Emit ([ordered]@{ kind = 'unsupported'; reason = "arch=$arch ps64=$env64 os64=$os64" })
  exit 0
}

# ---- P/Invoke の宣言 ----
$t0 = $clock.Elapsed.TotalMilliseconds
$long = [long]; $int = [int]; $uint = [uint32]; $ptr = [IntPtr]; $bool = [bool]
$sigs = @(
  @('kernel32.dll', 'OpenProcess', $ptr, @($uint, $bool, $uint)),
  @('kernel32.dll', 'CloseHandle', $bool, @($ptr)),
  @('kernel32.dll', 'GetProcessTimes', $bool, @($ptr, $long.MakeByRefType(), $long.MakeByRefType(), $long.MakeByRefType(), $long.MakeByRefType())),
  @('kernel32.dll', 'TerminateProcess', $bool, @($ptr, $uint)),
  @('kernel32.dll', 'WaitForSingleObject', $uint, @($ptr, $uint)),
  @('kernel32.dll', 'ReadProcessMemory', $bool, @($ptr, $ptr, [byte[]], $ptr, $ptr.MakeByRefType())),
  @('ntdll.dll', 'NtQueryInformationProcess', $int, @($ptr, $int, [byte[]], $int, $int.MakeByRefType()))
)
if ($in.api -eq 'addtype') {
  Add-Type -Namespace LoomakeProbe -Name Api -MemberDefinition @'
[DllImport("kernel32.dll", SetLastError = true)] public static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool CloseHandle(IntPtr h);
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool GetProcessTimes(IntPtr h, out long c, out long e, out long k, out long u);
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool TerminateProcess(IntPtr h, uint code);
[DllImport("kernel32.dll", SetLastError = true)] public static extern uint WaitForSingleObject(IntPtr h, uint ms);
[DllImport("kernel32.dll", SetLastError = true)] public static extern bool ReadProcessMemory(IntPtr h, IntPtr addr, byte[] buf, IntPtr size, out IntPtr read);
[DllImport("ntdll.dll")] public static extern int NtQueryInformationProcess(IntPtr h, int cls, byte[] buf, int len, out int ret);
'@
  $api = [LoomakeProbe.Api]
} else {
  $asm = [AppDomain]::CurrentDomain.DefineDynamicAssembly((New-Object Reflection.AssemblyName 'LoomakeProbeNative'), [Reflection.Emit.AssemblyBuilderAccess]::Run)
  $mod = $asm.DefineDynamicModule('LoomakeProbeNative')
  $tb = $mod.DefineType('LoomakeProbeNative.Api', 'Public, Class, Sealed')
  $dllImport = [Runtime.InteropServices.DllImportAttribute]
  $ctor = $dllImport.GetConstructor([Type[]]@([string]))
  $fields = [Reflection.FieldInfo[]]@($dllImport.GetField('SetLastError'), $dllImport.GetField('CharSet'))
  foreach ($s in $sigs) {
    $m = $tb.DefineMethod($s[1], 'Public, Static, PinvokeImpl, HideBySig', $s[2], [Type[]]$s[3])
    $m.SetImplementationFlags('PreserveSig')
    $attr = New-Object Reflection.Emit.CustomAttributeBuilder($ctor, [object[]]@($s[0]), $fields, [object[]]@($true, [Runtime.InteropServices.CharSet]::Unicode))
    $m.SetCustomAttribute($attr)
  }
  $api = $tb.CreateType()
}
$timing.define = [Math]::Round($clock.Elapsed.TotalMilliseconds - $t0, 1)

$QUERY_LIMITED = 0x1000; $FULL = 0x0400 -bor 0x0010 -bor 0x0001 -bor 0x00100000
$needle = "LOOMAKE_SUPERVISOR_MARK=$($in.mark)"
$lower = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$in.fromMs - [long]$in.slackMs).UtcDateTime.ToFileTimeUtc()

function Created([IntPtr]$h) {
  $c = 0L; $e = 0L; $k = 0L; $u = 0L
  if (-not $api::GetProcessTimes($h, [ref]$c, [ref]$e, [ref]$k, [ref]$u)) { return $null }
  return $c
}
function Ppid([IntPtr]$h) {
  $buf = New-Object byte[] 48; $ret = 0
  $st = $api::NtQueryInformationProcess($h, 0, $buf, 48, [ref]$ret)
  if ($st -ne 0) { return @{ ok = $false; status = ('0x{0:X8}' -f $st) } }
  return @{ ok = $true; peb = [BitConverter]::ToInt64($buf, 8); ppid = [BitConverter]::ToInt64($buf, 40) }
}
function ReadMem([IntPtr]$h, [long]$addr, [int]$size) {
  $buf = New-Object byte[] $size; $read = [IntPtr]::Zero
  if (-not $api::ReadProcessMemory($h, [IntPtr]$addr, $buf, [IntPtr]$size, [ref]$read)) { return $null }
  if ($read.ToInt64() -ne $size) { return $null }
  return ,$buf
}
# 印を読む。戻り値の state：marked / other-mark / no-mark / unreadable（reason つき）
function ReadMark([IntPtr]$h, [long]$peb) {
  if ($peb -eq 0) { return @{ state = 'unreadable'; reason = 'peb=0' } }
  $p = ReadMem $h ($peb + 0x20) 8
  if (-not $p) { return @{ state = 'unreadable'; reason = "peb read err=$([Runtime.InteropServices.Marshal]::GetLastWin32Error())" } }
  $params = [BitConverter]::ToInt64($p, 0)
  if ($params -eq 0) { return @{ state = 'unreadable'; reason = 'params=0' } }
  $q = ReadMem $h ($params + 0x80) 8
  $z = ReadMem $h ($params + 0x3F0) 8
  if (-not $q -or -not $z) { return @{ state = 'unreadable'; reason = 'params read' } }
  $envAddr = [BitConverter]::ToInt64($q, 0); $size = [BitConverter]::ToInt64($z, 0)
  if ($envAddr -eq 0 -or $size -le 0 -or $size -gt 1048576 -or ($size % 2) -ne 0) { return @{ state = 'unreadable'; reason = "size=$size" } }
  $blk = ReadMem $h $envAddr ([int]$size)
  if (-not $blk) { return @{ state = 'unreadable'; reason = 'env read' } }
  $text = [Text.Encoding]::Unicode.GetString($blk)
  $end = $text.IndexOf("`0`0")
  if ($end -lt 0) { return @{ state = 'unreadable'; reason = 'no terminator' } }
  foreach ($v in $text.Substring(0, $end).Split([char]0)) {
    if ($v -ceq $needle) { return @{ state = 'marked' } }
    if ($v.StartsWith('LOOMAKE_SUPERVISOR_MARK=', [StringComparison]::OrdinalIgnoreCase)) { return @{ state = 'other-mark' } }
  }
  return @{ state = 'no-mark' }
}

$held = @{}      # pid -> @{ h; created }
$seen = @{}      # pid:created -> record
$records = New-Object System.Collections.ArrayList
$timing.enumerate = 0; $timing.identify = 0; $timing.stop = 0
$pass = 0
do {
  $pass++
  $newMarked = 0
  $t = $clock.Elapsed.TotalMilliseconds
  $all = [Diagnostics.Process]::GetProcesses()
  $candidates = New-Object System.Collections.ArrayList
  foreach ($p in $all) {
    $id = $p.Id
    if ($id -eq 0 -or $id -eq 4 -or $id -eq $PID -or $held.ContainsKey($id)) { continue }
    $hl = $api::OpenProcess($QUERY_LIMITED, $false, [uint32]$id)
    if ($hl -eq [IntPtr]::Zero) { [void]$records.Add([ordered]@{ pid = $id; state = 'skipped-open-limited'; err = [Runtime.InteropServices.Marshal]::GetLastWin32Error() }); continue }
    $c = Created $hl
    $pp = Ppid $hl
    [void]$api::CloseHandle($hl)
    if ($null -eq $c -or $c -lt $lower) { continue }
    [void]$candidates.Add(@{ pid = $id; created = $c; ppid = $(if ($pp.ok) { $pp.ppid } else { -1 }) })
  }
  $timing.enumerate += $clock.Elapsed.TotalMilliseconds - $t
  $t = $clock.Elapsed.TotalMilliseconds
  $kill = New-Object System.Collections.ArrayList
  foreach ($cand in $candidates) {
    if ((Left) -le 0) { break }
    $key = "$($cand.pid):$($cand.created)"
    if ($seen.ContainsKey($key)) { continue }
    $rec = [ordered]@{ pid = $cand.pid; ppid = $cand.ppid; created = $cand.created; pass = $pass }
    $h = $api::OpenProcess([uint32]$FULL, $false, [uint32]$cand.pid)
    if ($h -eq [IntPtr]::Zero) {
      $rec.state = 'unreadable'; $rec.reason = "open err=$([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
    } else {
      $c2 = Created $h
      if ($c2 -ne $cand.created) { $rec.state = 'reused'; [void]$api::CloseHandle($h) }
      else {
        $pp = Ppid $h
        if (-not $pp.ok) { $rec.state = 'unreadable'; $rec.reason = "pbi $($pp.status)"; [void]$api::CloseHandle($h) }
        else {
          $m = ReadMark $h $pp.peb
          $rec.state = $m.state; if ($m.reason) { $rec.reason = $m.reason }
          if ($m.state -eq 'marked') { $held[$cand.pid] = @{ h = $h; created = $c2 }; [void]$kill.Add($cand.pid); $newMarked++ }
          else { [void]$api::CloseHandle($h) }
        }
      }
    }
    $seen[$key] = $rec
    [void]$records.Add($rec)
  }
  $timing.identify += $clock.Elapsed.TotalMilliseconds - $t
  $t = $clock.Elapsed.TotalMilliseconds
  foreach ($id in $kill) {
    $rec = $seen["$($id):$($held[$id].created)"]
    if ($in.terminate) {
      if ($api::TerminateProcess($held[$id].h, 1)) { $rec.action = 'terminated' } else { $rec.action = "terminate err=$([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
    } else { $rec.action = 'dry-run' }
  }
  $timing.stop += $clock.Elapsed.TotalMilliseconds - $t
} while ($in.terminate -and $newMarked -gt 0 -and (Left) -gt 0 -and $pass -lt [int]$in.maxPasses)

$t = $clock.Elapsed.TotalMilliseconds
foreach ($id in @($held.Keys)) {
  $rec = $seen["$($id):$($held[$id].created)"]
  if ($in.terminate) {
    $w = $api::WaitForSingleObject($held[$id].h, [uint32][Math]::Floor((Left)))
    $rec.wait = $(if ($w -eq 0) { 'exited' } elseif ($w -eq 258) { 'timeout' } else { "wait=$w" })
  }
  [void]$api::CloseHandle($held[$id].h)
}
$timing.wait = $clock.Elapsed.TotalMilliseconds - $t
$timing.total = $clock.Elapsed.TotalMilliseconds
$timing.passes = $pass
$markedPids = @($held.Keys)
foreach ($r in $records) {
  if ($r.state -in @('no-mark', 'unreadable', 'other-mark') -and ($r.ppid -eq [long]$in.targetPid -or $markedPids -contains $r.ppid)) { $r.possible = $true }
}
foreach ($k in @($timing.Keys)) { if ($timing[$k] -is [double]) { $timing[$k] = [Math]::Round($timing[$k], 1) } }
Emit ([ordered]@{ kind = 'timing'; timing = $timing; candidates = $records.Count })
foreach ($r in $records) {
  if ($r.state -eq 'skipped-open-limited') { continue }
  $o = [ordered]@{ kind = 'process' }
  foreach ($k in $r.Keys) { $o[$k] = $r[$k] }
  Emit $o
}
Emit ([ordered]@{ kind = 'summary'; skippedLimited = @($records | Where-Object { $_.state -eq 'skipped-open-limited' }).Count; states = ($records | Group-Object { $_.state } | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join ',' })
