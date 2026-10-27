# PROBE (throwaway, do not merge): B-3 holder for PR #22 Q-05.
# Holds process handles so that PIDs are not reused, and cleans up descendants with the same handles.
# Uses only handle-based APIs: OpenProcess, GetProcessTimes, GetExitCodeProcess, NtQueryInformationProcess(ProcessBasicInformation, parent PID only),
# TerminateProcess, WaitForSingleObject, CloseHandle. It never reads the memory of other processes.
# Modes (env HOLDER_MODE): 'holder' (default) or 'check' (open CHECK_PID once and print its state).
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding $false
$clock = [Diagnostics.Stopwatch]::StartNew()
function NowMs { [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
function Json($o) { $o | ConvertTo-Json -Compress -Depth 6 }

$t = $clock.Elapsed.TotalMilliseconds
$long = [long]; $int = [int]; $uint = [uint32]; $ptr = [IntPtr]; $bool = [bool]
$sigs = @(
  @('kernel32.dll', 'OpenProcess', $ptr, @($uint, $bool, $uint)),
  @('kernel32.dll', 'CloseHandle', $bool, @($ptr)),
  @('kernel32.dll', 'GetProcessTimes', $bool, @($ptr, $long.MakeByRefType(), $long.MakeByRefType(), $long.MakeByRefType(), $long.MakeByRefType())),
  @('kernel32.dll', 'GetExitCodeProcess', $bool, @($ptr, $uint.MakeByRefType())),
  @('kernel32.dll', 'TerminateProcess', $bool, @($ptr, $uint)),
  @('kernel32.dll', 'WaitForSingleObject', $uint, @($ptr, $uint)),
  @('ntdll.dll', 'NtQueryInformationProcess', $int, @($ptr, $int, [byte[]], $int, $int.MakeByRefType()))
)
$asm = [AppDomain]::CurrentDomain.DefineDynamicAssembly((New-Object Reflection.AssemblyName 'LoomakeHolderNative'), [Reflection.Emit.AssemblyBuilderAccess]::Run)
$mod = $asm.DefineDynamicModule('LoomakeHolderNative')
$tb = $mod.DefineType('LoomakeHolderNative.Api', 'Public, Class, Sealed')
$attr = [Runtime.InteropServices.DllImportAttribute]
$ctor = $attr.GetConstructor([Type[]]@([string]))
$fields = [Reflection.FieldInfo[]]@($attr.GetField('SetLastError'))
foreach ($s in $sigs) {
  $m = $tb.DefineMethod($s[1], 'Public, Static, PinvokeImpl, HideBySig', $s[2], [Type[]]$s[3])
  $m.SetImplementationFlags('PreserveSig')
  $m.SetCustomAttribute((New-Object Reflection.Emit.CustomAttributeBuilder($ctor, [object[]]@($s[0]), $fields, [object[]]@($true))))
}
$api = $tb.CreateType()
$defineMs = $clock.Elapsed.TotalMilliseconds - $t

$QL = 0x1000; $SYNC = 0x00100000; $TERM = 0x0001
function LastErr { [Runtime.InteropServices.Marshal]::GetLastWin32Error() }
function Created([IntPtr]$h) { $c = 0L; $e = 0L; $k = 0L; $u = 0L; if ($api::GetProcessTimes($h, [ref]$c, [ref]$e, [ref]$k, [ref]$u)) { return $c } return $null }
function ExitCode([IntPtr]$h) { $x = [uint32]0; if ($api::GetExitCodeProcess($h, [ref]$x)) { return $x } return $null }
function ParentPid([IntPtr]$h) {
  $buf = New-Object byte[] 48; $ret = 0
  if ($api::NtQueryInformationProcess($h, 0, $buf, 48, [ref]$ret) -ne 0) { return $null }
  return [BitConverter]::ToInt64($buf, 40)
}

if ($env:HOLDER_MODE -eq 'check') {
  $id = [uint32]$env:CHECK_PID
  $h = $api::OpenProcess($QL -bor $SYNC, $false, $id); $err = LastErr
  if ($h -eq [IntPtr]::Zero) { [Console]::Out.WriteLine((Json @{ ok = $false; err = $err })); exit 0 }
  [Console]::Out.WriteLine((Json @{ ok = $true; created = "$(Created $h)"; exitCode = (ExitCode $h) }))
  [void]$api::CloseHandle($h); exit 0
}

$dir = $env:HOLDER_DIR
$pipeName = $env:HOLDER_PIPE
$logFile = Join-Path $dir 'holder.log'
function Log($o) { $o.at = NowMs; [IO.File]::AppendAllText($logFile, (Json $o) + "`n") }
$holds = @{}

function NewServer {
  $s = New-Object IO.Pipes.NamedPipeServerStream($pipeName, [IO.Pipes.PipeDirection]::InOut, 254, [IO.Pipes.PipeTransmissionMode]::Byte, [IO.Pipes.PipeOptions]::Asynchronous)
  return @{ s = $s; t = $s.WaitForConnectionAsync() }
}
function Hold($req) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $h = $api::OpenProcess($QL -bor $SYNC, $false, [uint32]$req.pid); $err = LastErr
  if ($h -eq [IntPtr]::Zero) { return @{ id = $req.id; ok = $false; err = $err } }
  $c = Created $h
  $script:holds[[string]$req.id] = @{ h = $h; pid = [int]$req.pid; created = $c; expires = [long]$req.expiresAt }
  Log @{ ev = 'hold'; id = $req.id; pid = $req.pid; created = "$c"; handle = $h.ToInt64() }
  return @{ id = $req.id; ok = $true; created = "$c"; exitCode = (ExitCode $h); handle = $h.ToInt64(); openMs = $sw.Elapsed.TotalMilliseconds }
}
function Release([string]$id, [string]$why) {
  $e = $script:holds[$id]
  if ($null -eq $e) { return $false }
  [void]$api::CloseHandle($e.h); $script:holds.Remove($id)
  Log @{ ev = 'release'; id = $id; why = $why }
  return $true
}

function Cleanup([string]$id, [long]$deadlineMs) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $timing = [ordered]@{ enumerate = 0.0; stop = 0.0; wait = 0.0 }
  $problems = New-Object Collections.ArrayList
  $e = $script:holds[$id]
  if ($null -eq $e) { return @{ confirmed = $false; problems = @('no-hold'); records = @(); timing = $timing; total = $sw.Elapsed.TotalMilliseconds } }
  if ((Created $e.h) -ne $e.created) { return @{ confirmed = $false; problems = @('target-mismatch'); records = @(); timing = $timing; total = $sw.Elapsed.TotalMilliseconds } }
  $known = @{ ([int]$e.pid) = [long]$e.created }
  $held = [ordered]@{}
  $pass = 0; $stable = $false
  function Left { [Math]::Max(0, $deadlineMs - (NowMs) - 200) }
  while ((Left) -gt 0) {
    $pass++
    $t0 = $sw.Elapsed.TotalMilliseconds
    $info = @{}
    foreach ($p in [Diagnostics.Process]::GetProcesses()) {
      $procId = $p.Id; $p.Dispose()
      if ($procId -eq 0 -or $known.ContainsKey($procId)) { continue }
      $limited = $false
      $h = $api::OpenProcess($QL -bor $SYNC -bor $TERM, $false, [uint32]$procId)
      if ($h -eq [IntPtr]::Zero) { $h = $api::OpenProcess($QL, $false, [uint32]$procId); $limited = $true }
      if ($h -eq [IntPtr]::Zero) { continue }
      $c = Created $h; $pp = ParentPid $h
      if ($null -eq $c -or $null -eq $pp) { [void]$api::CloseHandle($h); continue }
      $info[$procId] = @{ h = $h; created = [long]$c; ppid = [int]$pp; limited = $limited }
    }
    $new = New-Object Collections.ArrayList
    do {
      $changed = $false
      foreach ($procId in @($info.Keys)) {
        $x = $info[$procId]
        if (-not $known.ContainsKey($x.ppid)) { continue }
        $pc = $known[$x.ppid]
        if ($x.created -gt $pc) {
          $known[$procId] = $x.created
          $held[[string]$procId] = [ordered]@{ pid = $procId; ppid = $x.ppid; created = "$($x.created)"; pass = $pass; opens = 1; handle = $x.h.ToInt64(); h = $x.h; limited = $x.limited }
          [void]$new.Add($procId); $info.Remove($procId); $changed = $true
        } elseif ($x.created -eq $pc) {
          [void]$problems.Add("same-tick:$procId"); [void]$api::CloseHandle($x.h); $info.Remove($procId)
        }
      }
    } while ($changed)
    foreach ($x in $info.Values) { [void]$api::CloseHandle($x.h) }
    $timing.enumerate += $sw.Elapsed.TotalMilliseconds - $t0
    if ($new.Count -eq 0) { $stable = $true; break }
    $t0 = $sw.Elapsed.TotalMilliseconds
    foreach ($procId in $new) {
      $r = $held[[string]$procId]
      if ($r.limited) { $r.action = 'failed'; $r.reason = 'terminate:5'; [void]$problems.Add("terminate:5:$procId"); continue }
      $r.stopHandle = $r.h.ToInt64()
      if ($api::TerminateProcess($r.h, 1)) { $r.action = 'terminated' } else { $r.action = 'failed'; $r.reason = "terminate:$(LastErr)"; [void]$problems.Add("terminate:$procId") }
    }
    $timing.stop += $sw.Elapsed.TotalMilliseconds - $t0
  }
  if (-not $stable) { [void]$problems.Add('timeout') }
  $t0 = $sw.Elapsed.TotalMilliseconds
  foreach ($r in $held.Values) {
    $r.waitHandle = $r.h.ToInt64()
    $w = $api::WaitForSingleObject($r.h, [uint32][Math]::Floor((Left)))
    $r.wait = $(if ($w -eq 0) { 'exited' } elseif ($w -eq 258) { 'timeout' } else { "failed:$w" })
    if ($r.wait -ne 'exited') { [void]$problems.Add("alive:$($r.pid)") }
    [void]$api::CloseHandle($r.h); $r.Remove('h')
  }
  $timing.wait = $sw.Elapsed.TotalMilliseconds - $t0
  return @{ confirmed = ($stable -and $problems.Count -eq 0); passes = $pass; problems = @($problems); records = @($held.Values); timing = $timing; total = $sw.Elapsed.TotalMilliseconds }
}

$server = NewServer
$sessions = New-Object Collections.ArrayList
$stdin = [Console]::OpenStandardInput()
$stdinBuf = New-Object byte[] 256
$stdinTask = $stdin.ReadAsync($stdinBuf, 0, 256)
[IO.File]::WriteAllText((Join-Path $dir 'ready'), (Json @{ pid = $PID; readyMs = $clock.Elapsed.TotalMilliseconds; defineMs = $defineMs }))
Log @{ ev = 'ready'; readyMs = $clock.Elapsed.TotalMilliseconds; defineMs = $defineMs }

while ($true) {
  if ($server.t.IsCompleted) {
    $s = $server.s
    $reader = New-Object IO.StreamReader($s)
    [void]$sessions.Add(@{ s = $s; r = $reader; t = $reader.ReadLineAsync() })
    $server = NewServer
  }
  foreach ($sess in @($sessions)) {
    if (-not $sess.t.IsCompleted) { continue }
    $line = $null
    try { $line = $sess.t.Result } catch { $line = $null }
    if ($line) {
      try { $reply = Hold ($line | ConvertFrom-Json) } catch { $reply = @{ ok = $false; err = 'exception:' + $_.Exception.Message } }
      try { $w = New-Object IO.StreamWriter($sess.s); $w.WriteLine((Json $reply)); $w.Flush() } catch { Log @{ ev = 'reply-failed'; error = $_.Exception.Message } }
    }
    try { $sess.s.Dispose() } catch { }
    $sessions.Remove($sess)
  }
  foreach ($f in [IO.Directory]::GetFiles($dir, 'req-*.json')) {
    $req = [IO.File]::ReadAllText($f) | ConvertFrom-Json
    [IO.File]::Delete($f)
    $name = [IO.Path]::GetFileName($f).Replace('req-', 'res-')
    if ($req.op -eq 'release') { $res = @{ released = (Release ([string]$req.id) 'request') } }
    elseif ($req.op -eq 'cleanup') { $res = Cleanup ([string]$req.id) ([long]$req.deadlineMs); [void](Release ([string]$req.id) 'after-cleanup') }
    elseif ($req.op -eq 'state') { $res = @{ holds = @($holds.Keys) } }
    else { $res = @{ error = 'unknown-op' } }
    $tmp = Join-Path $dir ($name + '.tmp')
    [IO.File]::WriteAllText($tmp, (Json $res))
    [IO.File]::Move($tmp, (Join-Path $dir $name))
  }
  $now = NowMs
  foreach ($id in @($holds.Keys)) { if ($holds[$id].expires -le $now) { [void](Release $id 'expired') } }
  if ($stdinTask.IsCompleted) {
    $n = 0; try { $n = $stdinTask.Result } catch { $n = 0 }
    if ($n -le 0) {
      foreach ($id in @($holds.Keys)) { [void](Release $id 'parent-gone') }
      Log @{ ev = 'exit'; why = 'stdin-eof' }
      exit 0
    }
    $stdinTask = $stdin.ReadAsync($stdinBuf, 0, 256)
  }
  Start-Sleep -Milliseconds 5
}
