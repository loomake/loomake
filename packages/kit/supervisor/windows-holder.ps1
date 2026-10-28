# runExternal が Windows で使う保持役（REQ-252・REQ-253・REQ-255・REQ-256）。loomake のプロセスごとに 1 つ起動して使い回す。
# 監視役から名前つきパイプで対象の PID を受け取り、対象のハンドルを持ち続けて、後片付けを終えるまで PID を再利用させない。
# 親からは作業用のディレクトリのファイルで、解放と後片付けの頼みを受け取る。
# 使うのは、ハンドルから読める作成時刻・親の PID・終了の状態と、停止・待機だけで、ほかのプロセスのメモリは読まない。
#   OpenProcess、GetProcessTimes、NtQueryInformationProcess（ProcessBasicInformation の親の PID だけ）、TerminateProcess、WaitForSingleObject、CloseHandle
# 日本語のコメントを Windows PowerShell 5.1 が正しく読むよう、このファイルは BOM つきの UTF-8 で保存する。
# 環境変数：LOOMAKE_HOLDER_DIR（作業用のディレクトリ）、LOOMAKE_HOLDER_PIPE（パイプの名前。\\.\pipe\ を除いた部分）
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$clock = [Diagnostics.Stopwatch]::StartNew()
function NowMs { [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
function Json($o) { $o | ConvertTo-Json -Compress -Depth 6 }

$long = [long]; $int = [int]; $uint = [uint32]; $ptr = [IntPtr]; $bool = [bool]
$sigs = @(
  @('kernel32.dll', 'OpenProcess', $ptr, @($uint, $bool, $uint)),
  @('kernel32.dll', 'CloseHandle', $bool, @($ptr)),
  @('kernel32.dll', 'GetProcessTimes', $bool, @($ptr, $long.MakeByRefType(), $long.MakeByRefType(), $long.MakeByRefType(), $long.MakeByRefType())),
  @('kernel32.dll', 'TerminateProcess', $bool, @($ptr, $uint)),
  @('kernel32.dll', 'WaitForSingleObject', $uint, @($ptr, $uint)),
  @('ntdll.dll', 'NtQueryInformationProcess', $int, @($ptr, $int, [byte[]], $int, $int.MakeByRefType()))
)
# Reflection.Emit で宣言し、C# のコンパイルを使わない
$asm = [AppDomain]::CurrentDomain.DefineDynamicAssembly((New-Object Reflection.AssemblyName 'LoomakeHolderNative'), [Reflection.Emit.AssemblyBuilderAccess]::Run)
$tb = $asm.DefineDynamicModule('LoomakeHolderNative').DefineType('LoomakeHolderNative.Api', 'Public, Class, Sealed')
$attr = [Runtime.InteropServices.DllImportAttribute]
$ctor = $attr.GetConstructor([Type[]]@([string]))
$fields = [Reflection.FieldInfo[]]@($attr.GetField('SetLastError'))
foreach ($s in $sigs) {
  $m = $tb.DefineMethod($s[1], 'Public, Static, PinvokeImpl, HideBySig', $s[2], [Type[]]$s[3])
  $m.SetImplementationFlags('PreserveSig')
  $m.SetCustomAttribute((New-Object Reflection.Emit.CustomAttributeBuilder($ctor, [object[]]@($s[0]), $fields, [object[]]@($true))))
}
$api = $tb.CreateType()

$QL = 0x1000; $SYNC = 0x00100000; $TERM = 0x0001
function LastErr { [Runtime.InteropServices.Marshal]::GetLastWin32Error() }
function Created([IntPtr]$h) { $c = 0L; $e = 0L; $k = 0L; $u = 0L; if ($api::GetProcessTimes($h, [ref]$c, [ref]$e, [ref]$k, [ref]$u)) { return $c } return $null }
function ParentPid([IntPtr]$h) {
  # PROCESS_BASIC_INFORMATION の InheritedFromUniqueProcessId（64 ビットでは 40 バイト目）だけを読む。PEB の位置の欄は使わない
  $buf = New-Object byte[] 48; $ret = 0
  if ($api::NtQueryInformationProcess($h, 0, $buf, 48, [ref]$ret) -ne 0) { return $null }
  return [BitConverter]::ToInt64($buf, 40)
}

$dir = $env:LOOMAKE_HOLDER_DIR
$pipeName = $env:LOOMAKE_HOLDER_PIPE
$holds = @{}

function Hold($req) {
  $id = [string]$req.id
  $h = $api::OpenProcess($QL -bor $SYNC, $false, [uint32]$req.pid); $err = LastErr
  if ($h -eq [IntPtr]::Zero) { return @{ id = $id; ok = $false; err = $err } }
  $c = Created $h
  if ($null -eq $c) { [void]$api::CloseHandle($h); return @{ id = $id; ok = $false; err = 'times' } }
  if ($script:holds.ContainsKey($id)) { [void]$api::CloseHandle($script:holds[$id].h) }
  $script:holds[$id] = @{ h = $h; pid = [int]$req.pid; created = [long]$c; expires = [long]$req.expiresAt }
  return @{ id = $id; ok = $true; created = "$c" }
}
function Release([string]$id) {
  $e = $script:holds[$id]
  if ($null -eq $e) { return $false }
  [void]$api::CloseHandle($e.h); $script:holds.Remove($id)
  return $true
}

# 後片付け（design.md の「後片付けの流れ」）。どれを未確認とするかは、親の TypeScript の関数が決める
function Cleanup($req) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $deadline = [long]$req.deadlineMs
  $timing = [ordered]@{ enumerate = 0; stop = 0; wait = 0; total = 0 }
  $result = [ordered]@{ kind = 'cleanup'; target = 'held'; passes = 0; stable = $false; records = @(); timing = $timing }
  # 結果を書いて親が読むための 200ms を残す
  function Left { [Math]::Max(0, $deadline - (NowMs) - 200) }
  # 1. 対象の確認：保持中のハンドルの作成時刻が、監視役が親へ渡した値と同じか。保持がなければ（期限切れ・解放済み・保持役が起動し直した）、何も止めない
  $e = $script:holds[[string]$req.id]
  $targetCreated = [long]$req.created
  if ($null -eq $e) { $result.target = 'no-hold' }
  elseif ($e.pid -ne [int]$req.pid -or (Created $e.h) -ne $targetCreated) { $result.target = 'mismatch' }
  if ($result.target -eq 'mismatch' -or $result.target -eq 'no-hold') {
    $timing.total = [int]$sw.Elapsed.TotalMilliseconds
    return $result
  }
  # 識別済みの PID と作成時刻。最初は対象だけ
  $known = @{ ([int]$req.pid) = $targetCreated }
  $held = [ordered]@{}
  $records = New-Object Collections.ArrayList
  $seen = @{}
  while ((Left) -gt 0) {
    $result.passes++
    $t0 = $sw.Elapsed.TotalMilliseconds
    # 2. 探索：PID の一覧を取り、各プロセスを 1 回だけ開いて、ハンドルから作成時刻と親の PID を読む
    $ids = $null
    try {
      if ($null -ne $req.candidates) { $ids = @($req.candidates) }
      else { $ids = @([Diagnostics.Process]::GetProcesses() | ForEach-Object { $x = $_.Id; $_.Dispose(); @{ pid = $x } }) }
    } catch { $result.error = "enumerate:$($_.Exception.Message)"; break }
    $info = @{}
    foreach ($item in $ids) {
      $procId = [int]$item.pid
      if ($procId -eq 0 -or $known.ContainsKey($procId) -or $seen.ContainsKey($procId)) { continue }
      $limited = $false
      $h = $api::OpenProcess($QL -bor $SYNC -bor $TERM, $false, [uint32]$procId)
      if ($h -eq [IntPtr]::Zero) { $h = $api::OpenProcess($QL -bor $SYNC, $false, [uint32]$procId); $limited = $true }
      if ($h -eq [IntPtr]::Zero) {
        $err = LastErr
        if ($null -ne $req.candidates) { [void]$records.Add([ordered]@{ pid = $procId; state = 'unopenable'; reason = "open:$err"; opens = 1 }); $seen[$procId] = $true }
        continue
      }
      $c = Created $h; $pp = ParentPid $h
      if ($null -eq $c -or $null -eq $pp) { [void]$api::CloseHandle($h); continue }
      # 試験で与えた候補の作成時刻が、開いたハンドルの作成時刻と違えば、列挙のあとに入れ替わったものとして扱わない
      if ($null -ne $item.created -and [long]$item.created -ne [long]$c) {
        [void]$records.Add([ordered]@{ pid = $procId; state = 'replaced'; created = "$c"; listed = "$($item.created)"; opens = 1 }); $seen[$procId] = $true
        [void]$api::CloseHandle($h); continue
      }
      $info[$procId] = @{ h = $h; created = [long]$c; ppid = [int]$pp; limited = $limited }
    }
    # 識別済みのどれかが親で、作成時刻が親より後のものを子孫とする。加えたものの子も同じ探索の中でたどる
    $new = New-Object Collections.ArrayList
    do {
      $changed = $false
      foreach ($procId in @($info.Keys)) {
        $x = $info[$procId]
        if (-not $known.ContainsKey($x.ppid)) { continue }
        $pc = $known[$x.ppid]
        if ($x.created -gt $pc) {
          $known[$procId] = $x.created
          $r = [ordered]@{ pid = $procId; ppid = $x.ppid; created = "$($x.created)"; state = 'descendant'; pass = $result.passes; opens = 1; handle = $x.h.ToInt64(); access = $(if ($x.limited) { 'limited' } else { 'full' }) }
          $held[[string]$procId] = @{ r = $r; h = $x.h; limited = $x.limited }
          [void]$records.Add($r); [void]$new.Add($procId); $info.Remove($procId); $changed = $true
        } elseif ($x.created -eq $pc) {
          # 時計の刻みで前後を決められないものは止めない
          [void]$records.Add([ordered]@{ pid = $procId; ppid = $x.ppid; created = "$($x.created)"; state = 'same-tick'; opens = 1 }); $seen[$procId] = $true
          [void]$api::CloseHandle($x.h); $info.Remove($procId)
        }
      }
    } while ($changed)
    foreach ($x in $info.Values) { [void]$api::CloseHandle($x.h) }
    $timing.enumerate += [int]($sw.Elapsed.TotalMilliseconds - $t0)
    # 4. 新しい子孫が見つからない探索を 1 回終えたら、探し終えたとする
    if ($new.Count -eq 0) { $result.stable = $true; break }
    # 3. 停止：識別したのと同じハンドルで止める。TERMINATE の権限なしでしか開けなかったものは止めない
    $t0 = $sw.Elapsed.TotalMilliseconds
    foreach ($procId in $new) {
      $x = $held[[string]$procId]
      if ($x.limited) { $x.r.action = 'skipped'; $x.r.reason = 'terminate:5'; continue }
      $x.r.stopHandle = $x.h.ToInt64()
      if ($api::TerminateProcess($x.h, 1)) { $x.r.action = 'terminated' }
      else { $x.r.action = 'failed'; $x.r.reason = "terminate:$(LastErr)" }
    }
    $timing.stop += [int]($sw.Elapsed.TotalMilliseconds - $t0)
  }
  # 5. 待機：止めたプロセスの終了を、同じハンドルで期限まで待つ
  $t0 = $sw.Elapsed.TotalMilliseconds
  foreach ($x in $held.Values) {
    $x.r.waitHandle = $x.h.ToInt64()
    # 止めていないもの（権限不足）は待たずに、終わっているかだけを見る
    $ms = $(if ($x.limited) { 0 } else { [Math]::Floor((Left)) })
    $w = $api::WaitForSingleObject($x.h, [uint32]$ms)
    $x.r.wait = $(if ($w -eq 0) { 'exited' } elseif ($w -eq 258) { 'timeout' } else { "failed:$w" })
    [void]$api::CloseHandle($x.h)
  }
  $timing.wait = [int]($sw.Elapsed.TotalMilliseconds - $t0)
  $timing.total = [int]$sw.Elapsed.TotalMilliseconds
  $result.records = @($records)
  return $result
}

function NewServer {
  $s = New-Object IO.Pipes.NamedPipeServerStream($pipeName, [IO.Pipes.PipeDirection]::InOut, 254, [IO.Pipes.PipeTransmissionMode]::Byte, [IO.Pipes.PipeOptions]::Asynchronous)
  return @{ s = $s; t = $s.WaitForConnectionAsync() }
}
function Finish([string]$why) {
  foreach ($id in @($holds.Keys)) { [void](Release $id) }
  try { [IO.Directory]::Delete($dir, $true) } catch { }
  exit 0
}

# 待ち受けのインスタンスを 4 つ用意しておく。1 つだけだと、つないだ直後の監視役が次のインスタンスの用意を待たされ、外部操作ごとに対象の起動が遅れる
$servers = New-Object Collections.ArrayList
foreach ($i in 1..4) { [void]$servers.Add((NewServer)) }
$sessions = New-Object Collections.ArrayList
# 親が終わると stdin が閉じる（EOF）。そのときはすべての保持を解放して終わる
$stdin = [Console]::OpenStandardInput()
$stdinBuf = New-Object byte[] 256
$stdinTask = $stdin.ReadAsync($stdinBuf, 0, 256)
[IO.File]::WriteAllText((Join-Path $dir 'ready.tmp'), (Json @{ pid = $PID; readyMs = [int]$clock.Elapsed.TotalMilliseconds }))
[IO.File]::Move((Join-Path $dir 'ready.tmp'), (Join-Path $dir 'ready'))

while ($true) {
  for ($i = 0; $i -lt $servers.Count; $i++) {
    if (-not $servers[$i].t.IsCompleted) { continue }
    $s = $servers[$i].s
    $reader = New-Object IO.StreamReader($s)
    [void]$sessions.Add(@{ s = $s; r = $reader; t = $reader.ReadLineAsync() })
    $servers[$i] = NewServer
  }
  foreach ($sess in @($sessions)) {
    if (-not $sess.t.IsCompleted) { continue }
    $line = $null
    try { $line = $sess.t.Result } catch { $line = $null }
    if ($line) {
      try { $reply = Hold ($line | ConvertFrom-Json) } catch { $reply = @{ ok = $false; err = 'exception' } }
      try { $w = New-Object IO.StreamWriter($sess.s); $w.WriteLine((Json $reply)); $w.Flush() } catch { }
    }
    try { $sess.s.Dispose() } catch { }
    $sessions.Remove($sess)
  }
  foreach ($f in [IO.Directory]::GetFiles($dir, 'req-*.json')) {
    $req = $null
    try { $req = [IO.File]::ReadAllText($f) | ConvertFrom-Json } catch { }
    [IO.File]::Delete($f)
    if ($null -eq $req) { continue }
    $res = $null
    if ($req.op -eq 'release') { [void](Release ([string]$req.id)) }
    elseif ($req.op -eq 'cleanup') {
      try { $res = Cleanup $req } catch { $res = @{ kind = 'cleanup'; error = "exception:$($_.Exception.Message)" } }
      [void](Release ([string]$req.id))
    }
    elseif ($req.op -eq 'state') { $res = @{ holds = @($holds.Keys) } }
    if ($null -ne $res) {
      $name = [IO.Path]::GetFileName($f).Replace('req-', 'res-')
      $tmp = Join-Path $dir ('tmp-' + $name)
      [IO.File]::WriteAllText($tmp, (Json $res))
      [IO.File]::Move($tmp, (Join-Path $dir $name))
    }
  }
  $now = NowMs
  foreach ($id in @($holds.Keys)) { if ($holds[$id].expires -le $now) { [void](Release $id) } }
  if ($stdinTask.IsCompleted) {
    $n = 0; try { $n = $stdinTask.Result } catch { $n = 0 }
    if ($n -le 0) { Finish 'stdin-eof' }
    $stdinTask = $stdin.ReadAsync($stdinBuf, 0, 256)
  }
  Start-Sleep -Milliseconds 1
}
