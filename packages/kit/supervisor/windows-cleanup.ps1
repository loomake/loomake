# runExternal が Windows で使う後片付け（REQ-252・REQ-253・REQ-254）。監視役が結果を書かずに終わったときに 1 回だけ起動する。
# 環境変数 LOOMAKE_SUPERVISOR_MARK に実行ごとの印を持つプロセスだけを、印と作成時刻を確かめたのと同じハンドルで止め、同じハンドルで終了を待つ。
# 入力は環境変数 LOOMAKE_CLEANUP_INPUT の JSON：
#   { mark, targetPid, fromMs, slackMs, deadlineMs, maxPasses, candidates?: [{ pid, created }] }
# deadlineMs は壁時計の期限（Unix 時刻のミリ秒）。candidates は試験で探索の代わりに与える候補（created は FILETIME の文字列）。
# 出力は 1 行 1 件の JSON。理由は符号で返し、どれを未確認とするかと利用者に見せる文は呼び出し側が決める。
# 日本語のコメントを Windows PowerShell 5.1 が正しく読むよう、このファイルは BOM つきの UTF-8 で保存する。
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding $false
$clock = [Diagnostics.Stopwatch]::StartNew()
$in = $env:LOOMAKE_CLEANUP_INPUT | ConvertFrom-Json
function NowMs { [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
# 出力のための 200ms を残す
function Left { [Math]::Max(0, [double]$in.deadlineMs - (NowMs) - 200) }
function Emit($obj) { [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 5)) }
$timing = [ordered]@{ define = 0; enumerate = 0; identify = 0; stop = 0; wait = 0 }

$arch = $env:PROCESSOR_ARCHITECTURE
if (-not [Environment]::Is64BitProcess -or -not [Environment]::Is64BitOperatingSystem -or $arch -ne 'AMD64') {
  Emit ([ordered]@{ kind = 'unsupported'; reason = "unsupported-arch:$arch" })
  exit 0
}

# ---- P/Invoke の宣言（Reflection.Emit。コンパイルを使わない） ----
$t = $clock.Elapsed.TotalMilliseconds
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
$asm = [AppDomain]::CurrentDomain.DefineDynamicAssembly((New-Object Reflection.AssemblyName 'LoomakeCleanupNative'), [Reflection.Emit.AssemblyBuilderAccess]::Run)
$mod = $asm.DefineDynamicModule('LoomakeCleanupNative')
$tb = $mod.DefineType('LoomakeCleanupNative.Api', 'Public, Class, Sealed')
$dllImport = [Runtime.InteropServices.DllImportAttribute]
$ctor = $dllImport.GetConstructor([Type[]]@([string]))
$fields = [Reflection.FieldInfo[]]@($dllImport.GetField('SetLastError'), $dllImport.GetField('CharSet'))
foreach ($s in $sigs) {
  $m = $tb.DefineMethod($s[1], 'Public, Static, PinvokeImpl, HideBySig', $s[2], [Type[]]$s[3])
  $m.SetImplementationFlags('PreserveSig')
  $m.SetCustomAttribute((New-Object Reflection.Emit.CustomAttributeBuilder($ctor, [object[]]@($s[0]), $fields, [object[]]@($true, [Runtime.InteropServices.CharSet]::Unicode))))
}
$api = $tb.CreateType()
$timing.define = $clock.Elapsed.TotalMilliseconds - $t

$QUERY_LIMITED = 0x1000
$FULL = 0x0400 -bor 0x0010 -bor 0x0001 -bor 0x00100000
$MARK_NAME = 'LOOMAKE_SUPERVISOR_MARK'
$MAX_ENV = 1048576
$lower = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$in.fromMs - [long]$in.slackMs).UtcDateTime.ToFileTimeUtc()
function Created([IntPtr]$h) {
  $c = 0L; $e = 0L; $k = 0L; $u = 0L
  if (-not $api::GetProcessTimes($h, [ref]$c, [ref]$e, [ref]$k, [ref]$u)) { return $null }
  return $c
}
function Query([IntPtr]$h, [int]$cls, [int]$len) {
  $buf = New-Object byte[] $len; $ret = 0
  $st = $api::NtQueryInformationProcess($h, $cls, $buf, $len, [ref]$ret)
  if ($st -ne 0) { return $null }
  return ,$buf
}
function ReadMem([IntPtr]$h, [long]$addr, [int]$size) {
  $buf = New-Object byte[] $size; $read = [IntPtr]::Zero
  $ok = $api::ReadProcessMemory($h, [IntPtr]$addr, $buf, [IntPtr]$size, [ref]$read); $script:lastReadError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  if (-not $ok) { return $null }
  if ($read.ToInt64() -ne $size) { return $null }
  return ,$buf
}
function ReadPtr([IntPtr]$h, [long]$addr, [int]$width) {
  $b = ReadMem $h $addr $width
  if ($null -eq $b) { return $null }
  if ($width -eq 4) { return [long][BitConverter]::ToUInt32($b, 0) }
  return [BitConverter]::ToInt64($b, 0)
}
# 環境変数のブロックを、ページの境目ごとに読み進め、2 文字続きの NUL で終える
function ReadEnvBlock([IntPtr]$h, [long]$addr) {
  $acc = New-Object IO.MemoryStream
  $nul2 = [string]([char]0) + [string]([char]0)
  while ($acc.Length -lt $MAX_ENV) {
    $chunk = 4096 - [int]($addr % 4096)
    $b = ReadMem $h $addr $chunk
    if ($null -eq $b) { return @{ ok = $false; reason = "env-read:$($script:lastReadError)" } }
    $acc.Write($b, 0, $b.Length)
    $addr += $chunk
    $bytes = $acc.ToArray()
    $text = [Text.Encoding]::Unicode.GetString($bytes, 0, $bytes.Length - ($bytes.Length % 2))
    $end = $text.IndexOf($nul2)
    if ($end -ge 0) { return @{ ok = $true; text = $text.Substring(0, $end) } }
  }
  return @{ ok = $false; reason = 'env-too-large' }
}
# 印を読む。state：marked / other-mark / no-mark / unreadable
function ReadMark([IntPtr]$h) {
  $wow = Query $h 26 8
  if ($null -eq $wow) { return @{ state = 'unreadable'; reason = 'wow64-query' } }
  $peb32 = [BitConverter]::ToInt64($wow, 0)
  if ($peb32 -ne 0) {
    # WOW64 のプロセスは、32 ビットの側の環境を読む。64 ビットの側は、32 ビットの側で変えたあとも古いまま残ることがある
    $params = ReadPtr $h ($peb32 + 0x10) 4
    if ($params) { $envAddr = ReadPtr $h ($params + 0x48) 4 }
    $bits = 32
  } else {
    $pbi = Query $h 0 48
    if ($null -eq $pbi) { return @{ state = 'unreadable'; reason = 'peb-query' } }
    $peb = [BitConverter]::ToInt64($pbi, 8)
    $params = $null; $envAddr = $null
    if ($peb) { $params = ReadPtr $h ($peb + 0x20) 8 }
    if ($params) { $envAddr = ReadPtr $h ($params + 0x80) 8 }
    $bits = 64
  }
  if (-not $params -or -not $envAddr) { return @{ state = 'unreadable'; reason = "params-read:$($script:lastReadError)"; bits = $bits } }
  $block = ReadEnvBlock $h $envAddr
  if (-not $block.ok) { return @{ state = 'unreadable'; reason = $block.reason; bits = $bits } }
  $state = 'no-mark'
  foreach ($v in $block.text.Split([char]0)) {
    if ($v.Length -lt 2) { continue }
    $eq = $v.IndexOf('=', 1)
    if ($eq -lt 0) { continue }
    if (-not $v.Substring(0, $eq).Equals($MARK_NAME, [StringComparison]::OrdinalIgnoreCase)) { continue }
    $state = 'other-mark'
    foreach ($m in $v.Substring($eq + 1).Split(';')) { if ($m -ceq $in.mark) { return @{ state = 'marked'; bits = $bits } } }
  }
  return @{ state = $state; bits = $bits }
}

$held = [ordered]@{}   # pid -> @{ h; record }
$seen = @{}            # "pid:created" -> $true
$records = New-Object System.Collections.ArrayList
$pass = 0
$timedOut = $false
do {
  $pass++
  $newMarked = 0
  # 1. 探索：PID・親の PID・作成時刻
  $t = $clock.Elapsed.TotalMilliseconds
  $ids = @{}
  $createdOf = @{}
  $info = @{}
  foreach ($p in [Diagnostics.Process]::GetProcesses()) {
    $id = $p.Id
    $ids[$id] = $true
    if ($id -eq 0 -or $id -eq 4 -or $id -eq $PID) { continue }
    $hl = $api::OpenProcess($QUERY_LIMITED, $false, [uint32]$id)
    if ($hl -eq [IntPtr]::Zero) { continue }
    $c = Created $hl
    $pbi = Query $hl 0 48
    [void]$api::CloseHandle($hl)
    if ($null -eq $c) { continue }
    $createdOf[$id] = $c
    $info[$id] = @{ created = $c; ppid = $(if ($pbi) { [BitConverter]::ToInt64($pbi, 40) } else { -1 }) }
  }
  $candidates = New-Object System.Collections.ArrayList
  if ($in.candidates) {
    foreach ($cand in $in.candidates) { [void]$candidates.Add(@{ pid = [int]$cand.pid; created = [long]$cand.created; ppid = $(if ($info[[int]$cand.pid]) { $info[[int]$cand.pid].ppid } else { -1 }) }) }
  } else {
    foreach ($id in $info.Keys) { if ($info[$id].created -ge $lower) { [void]$candidates.Add(@{ pid = $id; created = $info[$id].created; ppid = $info[$id].ppid }) } }
  }
  $timing.enumerate += $clock.Elapsed.TotalMilliseconds - $t
  # 2. 識別：プロセスごとに 1 回だけ開き、そのハンドルで作成時刻と印を確かめる
  $t = $clock.Elapsed.TotalMilliseconds
  $kill = New-Object System.Collections.ArrayList
  foreach ($cand in $candidates) {
    if ((Left) -le 0) { $timedOut = $true; break }
    $key = "$($cand.pid):$($cand.created)"
    if ($seen.ContainsKey($key) -or $held.Contains($cand.pid)) { continue }
    $seen[$key] = $true
    $ppid = [long]$cand.ppid
    $parentGone = (-not $ids.ContainsKey([int]$ppid)) -or ($createdOf.ContainsKey([int]$ppid) -and $createdOf[[int]$ppid] -gt $cand.created)
    $rec = [ordered]@{ kind = 'process'; pid = $cand.pid; ppid = $ppid; created = "$($cand.created)"; parentGone = $parentGone; pass = $pass; opens = 0 }
    $h = $api::OpenProcess([uint32]$FULL, $false, [uint32]$cand.pid); $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    $rec.opens = 1
    if ($h -eq [IntPtr]::Zero) {
      $rec.state = 'unreadable'; $rec.reason = "open:$err"
      if ($err -eq 87) { $rec.state = 'exited' }
    } else {
      $rec.handle = $h.ToInt64()
      $c2 = Created $h
      if ($c2 -ne $cand.created) {
        $rec.state = 'replaced'
        [void]$api::CloseHandle($h)
      } else {
        try { $mark = ReadMark $h } catch { $mark = @{ state = 'unreadable'; reason = 'exception:' + $_.Exception.GetType().Name } }
        $rec.state = $mark.state
        if ($mark.reason) { $rec.reason = $mark.reason }
        if ($mark.bits) { $rec.bits = $mark.bits }
        if ($mark.state -eq 'marked') { $held[$cand.pid] = @{ h = $h; record = $rec }; [void]$kill.Add($cand.pid); $newMarked++ }
        else { [void]$api::CloseHandle($h) }
      }
    }
    [void]$records.Add($rec)
  }
  $timing.identify += $clock.Elapsed.TotalMilliseconds - $t
  # 3. 停止：識別に使ったのと同じハンドルで止める
  $t = $clock.Elapsed.TotalMilliseconds
  foreach ($id in $kill) {
    $entry = $held[$id]
    $entry.record.stopHandle = $entry.h.ToInt64()
    $ok = $api::TerminateProcess($entry.h, 1); $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    if ($ok) { $entry.record.action = 'terminated' }
    else { $entry.record.action = 'failed'; $entry.record.reason = "terminate:$err" }
  }
  $timing.stop += $clock.Elapsed.TotalMilliseconds - $t
} while (-not $in.candidates -and $newMarked -gt 0 -and (Left) -gt 0 -and $pass -lt [int]$in.maxPasses)

# 4. 待機：同じハンドルで終了を待つ
$t = $clock.Elapsed.TotalMilliseconds
foreach ($id in @($held.Keys)) {
  $entry = $held[$id]
  $entry.record.waitHandle = $entry.h.ToInt64()
  $w = $api::WaitForSingleObject($entry.h, [uint32][Math]::Floor((Left)))
  $entry.record.wait = $(if ($w -eq 0) { 'exited' } elseif ($w -eq 258) { 'timeout' } else { "failed $w" })
  [void]$api::CloseHandle($entry.h)
}
$timing.wait = $clock.Elapsed.TotalMilliseconds - $t
foreach ($r in $records) { Emit $r }
$timing.total = $clock.Elapsed.TotalMilliseconds
foreach ($k in @($timing.Keys)) { $timing[$k] = [Math]::Round($timing[$k], 1) }
Emit ([ordered]@{ kind = 'timing'; passes = $pass; timedOut = $timedOut; timing = $timing })
