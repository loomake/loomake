import { AsyncLocalStorage } from 'node:async_hooks';
import { spawnSync } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';
import { RuntimeFailure, UsageError } from './errors.js';

export const EXTERNAL_TIMEOUT_MS = 30_000;
export const EXTERNAL_OUTPUT_BYTES = 64 * 1024 * 1024;
type Budget = { deadline: number; maxOperationMs: number; state: { interrupted: boolean } };
const budgets = new AsyncLocalStorage<Budget>();
export type ProcessBudget = { timeoutMs: number; maxOperationMs?: number };
const monotonicMs = () => Number(process.hrtime.bigint()) / 1_000_000;

function positive(value: number) {
  if (!Number.isFinite(value) || value <= 0) throw new UsageError('外部操作の予算は正の有限数にしてください');
}
/** コールバックとその非同期処理だけへ期限を伝える。ネストで期限を延ばさない。 */
export function withProcessBudget<T>(options: ProcessBudget, action: () => T): T {
  positive(options.timeoutMs);
  const outer = budgets.getStore();
  const maxOperationMs = Math.min(options.maxOperationMs ?? EXTERNAL_TIMEOUT_MS, outer?.maxOperationMs ?? Infinity);
  positive(maxOperationMs);
  const deadline = Math.min(monotonicMs() + options.timeoutMs, outer?.deadline ?? Infinity);
  return budgets.run({ deadline, maxOperationMs, state: outer?.state ?? { interrupted: false } }, action);
}
export function remainingProcessTime(): number | undefined {
  const budget = budgets.getStore();
  return budget && Math.max(0, budget.deadline - monotonicMs());
}
export function hasProcessBudget(): boolean { return budgets.getStore() !== undefined; }

export type ProcessLimitKind = 'timeout' | 'output' | 'interrupted';
export class ProcessLimitError extends RuntimeFailure {
  /**
   * reason は、監視役が結果を書かずに終わったときなど、利用者の中断と区別する理由（REQ-250）。利用者の中断と期限・出力の上限では持たない
   */
  /**
   * cleanup は、監視役が結果を書かずに終わったときの子孫の後片付けの結果（REQ-254）。停止を確認できなかったときは confirmed が false で、reason にも理由を入れる
   */
  constructor(readonly kind: ProcessLimitKind, command: string, readonly stdout = '', readonly stderr = '', readonly reason?: string, readonly cleanup?: CleanupReport) {
    const label = kind === 'timeout' ? '実行時間の上限に達しました' : kind === 'output' ? '出力の上限に達しました' : '中断されました';
    super(`外部操作を止めました：${command}（${reason ? `${label}：${reason}` : label}）`);
  }
}
export type ExternalOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  shell?: boolean;
  timeoutMs?: number;
  maxBuffer?: number;
  /** 品質コマンドは操作単位の30秒でなく、明示した残り時間を使う。 */
  qualityCommand?: boolean;
  /** フックを動かす git の操作や PR の作成のように、1 操作の期限ではなく明示した残り時間と共有予算だけで止める（REQ-182） */
  untilDeadline?: boolean;
};
export type ExternalResult = { status: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string; error?: NodeJS.ErrnoException };
type Outcome = { status: number | null; signal: NodeJS.Signals | null; kind?: ProcessLimitKind; error?: { message: string; code?: string } };

// 監視役（supervisor/supervisor.cjs）。src/runtime/ から読んでも dist/runtime/ から読んでも 2 つ上にある。
// 対象の出力と制御情報を別のpipに流し、コマンド自身の出力を結果の形式と解釈しない。
const SUPERVISOR = fileURLToPath(new URL('../../supervisor/supervisor.cjs', import.meta.url));

/** 監視役が fd 3 に書いた、対象の PID（と起動の直前・直後の時刻）の行と結果。解釈できない行があれば invalid にする */
function readReport(text: string): { pid?: number; spawned?: { from: number; to: number }; outcome?: Outcome; invalid: boolean } {
  let pid: number | undefined;
  let spawned: { from: number; to: number } | undefined;
  let outcome: Outcome | undefined;
  let invalid = false;
  for (const line of text.split('\n')) {
    if (!line) continue;
    let value: unknown;
    try { value = JSON.parse(line); } catch { invalid = true; continue; }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid = true;
    else if ('status' in value) outcome = value as Outcome;
    else if ('pid' in value && Number.isSafeInteger(value.pid) && (value.pid as number) > 0) {
      pid = value.pid as number;
      const { from, to } = value as { from?: unknown; to?: unknown };
      if (typeof from === 'number' && typeof to === 'number' && Number.isFinite(from) && Number.isFinite(to) && from <= to) spawned = { from, to };
    } else invalid = true;
  }
  return { pid, spawned, outcome, invalid };
}

const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
/** target（POSIX はプロセスグループの -pid、Windows はプロセスの pid）が消えるまで最大 ms ミリ秒待つ。消えたら true */
function gone(target: number, ms: number): boolean {
  const until = monotonicMs() + ms;
  for (;;) {
    try { process.kill(target, 0); } catch { return true; }
    if (monotonicMs() >= until) return false;
    pause(10);
  }
}
// ---- Windows で親のいない子孫の後片付け ----

/**
 * Windows で監視役が結果を書かずに終わったときに、残った対象の子孫を識別して止める（REQ-252・REQ-253・REQ-254）。
 * 識別は純粋な関数（planOrphanCleanup）にし、一覧の取得と停止は WindowsProcessTools として差し替えられるようにする
 */

/** 後片付け（一覧の取得・識別・停止・終了の待機）の合計の上限。通常の共有予算とは別に、後片付けだけに使う（REQ-253） */
export const CLEANUP_LIMIT_MS = 10_000;
/** taskkill 1 回の上限（REQ-181・REQ-253） */
export const TASKKILL_LIMIT_MS = 1000;
/** 作成時刻の比較で見込む、時計の刻みの差（A-04） */
export const CLOCK_SLACK_MS = 50;

/** 監視役が渡した対象の PID と、対象を起動する直前（from）と直後（to）の時刻（Unix 時刻のミリ秒） */
export type OrphanTarget = { pid: number; from: number; to: number };
/** プロセスの一覧の 1 行。created は作成時刻（Unix 時刻のマイクロ秒） */
export type ProcessEntry = { pid: number; ppid: number; created: number };
export type StopRequest = { pid: number; created: number; root: boolean };
/**
 * stopped：止めて終了を確かめた / exited：開く前に終わっていた / reused：PID が別のプロセスに再利用されていた（元のプロセスは終わっている）/
 * denied：権限不足で止められない / failed：そのほかの理由で止められない / alive：期限までに終わらなかった
 */
export type StopResult = { pid: number; result: 'stopped' | 'exited' | 'reused' | 'denied' | 'failed' | 'alive'; message?: string };
export type ToolFailure = { ok: false; timedOut: boolean; message: string };
export type WindowsProcessTools = {
  list(timeoutMs: number): { ok: true; processes: ProcessEntry[] } | ToolFailure;
  stop(requests: StopRequest[], timeoutMs: number): { ok: true; results: StopResult[] } | ToolFailure;
};
/** 後片付けの結果。confirmed が false なら、detail に停止を確認できない理由を入れる（REQ-254） */
export type CleanupReport = { confirmed: boolean; detail: string };

export type OrphanPlan = {
  /** alive：対象がまだ動いている / gone：対象の PID を持つプロセスがない / reused：対象の PID が別のプロセスに再利用されている */
  target: 'alive' | 'gone' | 'reused';
  stop: StopRequest[];
  /** 同一性を確認できず、止めないプロセスとその理由 */
  unverified: string[];
};

/**
 * プロセスの一覧から、止める対象を決める（REQ-252）。observedAt は、親が監視役の終了を受け取った時刻（Unix 時刻のミリ秒）
 */
export function planOrphanCleanup(target: OrphanTarget, observedAt: number, processes: readonly ProcessEntry[], self = process.pid): OrphanPlan {
  const slack = CLOCK_SLACK_MS * 1000;
  const from = target.from * 1000 - slack;
  const to = target.to * 1000 + slack;
  const observed = observedAt * 1000;
  const holder = processes.find((p) => p.pid === target.pid);
  const unverified: string[] = [];
  let roots: ProcessEntry[];
  let state: OrphanPlan['target'];
  if (holder && holder.created >= from && holder.created <= to) {
    state = 'alive';
    roots = [holder];
  } else {
    // 対象がないか、PID が再利用されているときだけ、親の PID が対象の PID である子を探す
    state = holder ? 'reused' : 'gone';
    roots = [];
    for (const child of processes) {
      if (child.ppid !== target.pid || child.pid === target.pid || child.pid === self) continue;
      // 対象より前に作られたプロセスは、前の PID の持ち主の子で、対象の子ではない
      if (child.created < from) continue;
      if (child.created > observed) unverified.push(`PID ${child.pid} は監視役の終了を受け取ったあとに作られ、対象の子か確かめられません`);
      else if (holder && child.created >= holder.created) unverified.push(`PID ${child.pid} は、対象の PID ${target.pid} を再利用したプロセスの子か確かめられません`);
      else roots.push(child);
    }
  }
  const stop: StopRequest[] = roots.map((p) => ({ pid: p.pid, created: p.created, root: true }));
  const seen = new Set(stop.map((p) => p.pid));
  for (const parent of stop) {
    for (const child of processes) {
      if (child.ppid !== parent.pid || child.created < parent.created || seen.has(child.pid) || child.pid === self) continue;
      seen.add(child.pid);
      stop.push({ pid: child.pid, created: child.created, root: false });
    }
  }
  return { target: state, stop, unverified };
}

const RESULT_LABEL: Record<Exclude<StopResult['result'], 'stopped' | 'exited' | 'reused'>, string> = {
  denied: '権限不足で止められません',
  failed: '止められません',
  alive: '後片付けの上限までに終わりません',
};

/**
 * 一覧の取得・識別・停止・終了の待機を、合わせて limitMs（既定 10 秒）までに行う（REQ-252・REQ-253・REQ-254）。
 * 各手順には残り時間だけを渡し、候補の数によって期限を延ばさない
 */
export function cleanupWindowsOrphans(
  target: OrphanTarget, observedAt: number, tools: WindowsProcessTools, clock: () => number = monotonicMs, limitMs = CLEANUP_LIMIT_MS,
): CleanupReport {
  const started = clock();
  const deadline = started + limitMs;
  // 時間切れの診断に、各手順にかかった時間を残す
  let listMs = 0;
  const spent = (stopMs?: number) => `一覧の取得 ${Math.round(listMs)}ms${stopMs === undefined ? '' : `、停止と待機 ${Math.round(stopMs)}ms`}`;
  const timedOut = (step: string, stopMs?: number) => ({ confirmed: false, detail: `後片付けの上限（${limitMs / 1000} 秒）に達しました（${step}。${spent(stopMs)}）` });
  const listed = tools.list(limitMs);
  listMs = clock() - started;
  if (!listed.ok) return listed.timedOut ? timedOut('プロセスの一覧の取得中') : { confirmed: false, detail: `プロセスの一覧を取得できません：${listed.message}` };
  const plan = planOrphanCleanup(target, observedAt, listed.processes);
  const problems = [...plan.unverified];
  let stopMs: number | undefined;
  if (plan.stop.length > 0) {
    const left = deadline - clock();
    if (left <= 0) return timedOut('プロセスの一覧の取得のあと');
    const stopStarted = clock();
    const stopped = tools.stop(plan.stop, left);
    stopMs = clock() - stopStarted;
    if (!stopped.ok) return stopped.timedOut ? timedOut('停止と終了の待機中', stopMs) : { confirmed: false, detail: `子孫を止められません：${stopped.message}` };
    for (const request of plan.stop) {
      const result = stopped.results.find((r) => r.pid === request.pid);
      if (!result) problems.push(`PID ${request.pid} の停止の結果がありません`);
      else if (result.result === 'denied' || result.result === 'failed' || result.result === 'alive') {
        problems.push(`PID ${request.pid} は${RESULT_LABEL[result.result]}${result.message ? `（${result.message}）` : ''}`);
      }
    }
  }
  if (problems.length > 0) return { confirmed: false, detail: problems.join('、') };
  const subject = plan.target === 'alive' ? '対象' : '対象の子';
  const done = plan.stop.length ? `${subject}と子孫 ${plan.stop.length} 個を止めました` : '止める子孫はありませんでした';
  return { confirmed: true, detail: `${done}（${spent(stopMs)}）` };
}

// .NET の DateTime.Ticks（0001-01-01 からの 100ns 単位）と Unix 時刻の差
const EPOCH_TICKS = 621355968000000000n;
const toTicks = (micros: number) => (BigInt(micros) * 10n + EPOCH_TICKS).toString();
const fromTicks = (ticks: string) => Number((BigInt(ticks) - EPOCH_TICKS) / 10n);

const LIST_SCRIPT = `$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Get-CimInstance -ClassName Win32_Process -Property ProcessId,ParentProcessId,CreationDate | ForEach-Object {
  if ($_.CreationDate) { '{0} {1} {2}' -f $_.ProcessId, $_.ParentProcessId, $_.CreationDate.ToUniversalTime().Ticks }
}`;

// 各プロセスのハンドルを開いたまま作成時刻を一覧の値と比べ、一致したものだけを止める。
// ハンドルを持っている間は PID が再利用されないので、確かめたプロセスと止めるプロセスは同じになる
const STOP_SCRIPT = `$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$data = $env:LOOMAKE_ORPHAN_STOP | ConvertFrom-Json
$clock = [Diagnostics.Stopwatch]::StartNew()
function Left { [int][Math]::Max(0, [double]$data.limit - $clock.ElapsedMilliseconds) }
function Exited($proc) { try { return [bool]$proc.HasExited } catch { return $false } }
function Clean([string]$text) { ($text -replace '[\\t\\r\\n]+', ' ').Trim() }
$held = New-Object System.Collections.ArrayList
$out = New-Object System.Collections.ArrayList
foreach ($item in $data.items) {
  $id = [int]$item.pid
  $p = $null
  try { $p = [Diagnostics.Process]::GetProcessById($id) } catch { [void]$out.Add("$id\`texited\`t"); continue }
  try {
    $null = $p.Handle
    if (Exited $p) { [void]$out.Add("$id\`texited\`t"); continue }
    $t = $p.StartTime.ToUniversalTime().Ticks
    $t = $t - ($t % 10)
    if ($t -ne [long]$item.ticks) { [void]$out.Add("$id\`treused\`t"); continue }
    [void]$held.Add(@{ id = $id; p = $p; root = [bool]$item.root; result = '' ; message = '' })
  } catch {
    $e = $_.Exception
    while ($e.InnerException) { $e = $e.InnerException }
    if (Exited $p) { [void]$out.Add("$id\`texited\`t") }
    elseif ($e -is [ComponentModel.Win32Exception] -and $e.NativeErrorCode -eq 5) { [void]$out.Add("$id\`tdenied\`t" + (Clean $e.Message)) }
    else { [void]$out.Add("$id\`tfailed\`t" + (Clean $e.Message)) }
  }
}
foreach ($h in $held) {
  if (-not $h.root -or (Exited $h.p)) { continue }
  $info = New-Object Diagnostics.ProcessStartInfo
  $info.FileName = Join-Path $env:SystemRoot 'System32\\taskkill.exe'
  $info.Arguments = "/pid $($h.id) /T /F"
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  try {
    $tk = [Diagnostics.Process]::Start($info)
    if (-not $tk.WaitForExit([Math]::Min(${TASKKILL_LIMIT_MS}, (Left)))) { try { $tk.Kill() } catch {} }
  } catch {}
}
foreach ($h in $held) {
  if (Exited $h.p) { continue }
  try { $h.p.Kill() } catch {
    $e = $_.Exception
    while ($e.InnerException) { $e = $e.InnerException }
    if (-not (Exited $h.p)) {
      if ($e -is [ComponentModel.Win32Exception] -and $e.NativeErrorCode -eq 5) { $h.result = 'denied' } else { $h.result = 'failed' }
      $h.message = Clean $e.Message
    }
  }
}
foreach ($h in $held) {
  if ($h.result) { [void]$out.Add("$($h.id)\`t$($h.result)\`t$($h.message)"); continue }
  if ($h.p.WaitForExit((Left))) { [void]$out.Add("$($h.id)\`tstopped\`t") } else { [void]$out.Add("$($h.id)\`talive\`t") }
}
$out -join "\`n"`;

/** PowerShell のスクリプトを、上限の時間まで動かす。試験で差し替えられる */
export type PowerShellRunner = (script: string, timeoutMs: number, env?: NodeJS.ProcessEnv) => { ok: true; stdout: string } | ToolFailure;
export function runPowerShell(script: string, timeoutMs: number, env?: NodeJS.ProcessEnv, executable = 'powershell.exe'): { ok: true; stdout: string } | ToolFailure {
  if (timeoutMs <= 0) return { ok: false, timedOut: true, message: '時間がありません' };
  const result = spawnSync(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    encoding: 'utf8', timeout: Math.ceil(timeoutMs), killSignal: 'SIGKILL', windowsHide: true, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, ...env },
  });
  const error: NodeJS.ErrnoException | undefined = result.error;
  if (error) return { ok: false, timedOut: error.code === 'ETIMEDOUT', message: error.message };
  if (result.status !== 0) return { ok: false, timedOut: false, message: `PowerShell の終了コード ${String(result.status)}：${(result.stderr || '').trim().split(/\r?\n/)[0] ?? ''}` };
  return { ok: true, stdout: result.stdout };
}

/** PowerShell で一覧を取得し、ハンドルで確かめてから止める、Windows の道具を作る */
export function createWindowsProcessTools(powershell: PowerShellRunner = runPowerShell): WindowsProcessTools {
  return {
    list(timeoutMs) {
      const result = powershell(LIST_SCRIPT, timeoutMs);
      if (!result.ok) return result;
      const processes: ProcessEntry[] = [];
      for (const line of result.stdout.split(/\r?\n/)) {
        const match = /^(\d+) (\d+) (\d+)$/.exec(line.trim());
        if (match) processes.push({ pid: Number(match[1]), ppid: Number(match[2]), created: fromTicks(match[3]) });
      }
      if (processes.length === 0) return { ok: false, timedOut: false, message: 'プロセスの一覧が空です' };
      return { ok: true, processes };
    },
    stop(requests, timeoutMs) {
      // PowerShell の起動と出力のための時間を残して、中の待機の上限を決める
      const limit = Math.max(0, Math.floor(timeoutMs) - 500);
      const input = JSON.stringify({ limit, items: requests.map((r) => ({ pid: r.pid, ticks: toTicks(r.created), root: r.root })) });
      const result = powershell(STOP_SCRIPT, timeoutMs, { LOOMAKE_ORPHAN_STOP: input });
      if (!result.ok) return result;
      const results: StopResult[] = [];
      for (const line of result.stdout.split(/\r?\n/)) {
        const [pid, kind, message] = line.split('\t');
        if (!pid || !kind || !/^\d+$/.test(pid)) continue;
        if (!['stopped', 'exited', 'reused', 'denied', 'failed', 'alive'].includes(kind)) continue;
        results.push({ pid: Number(pid), result: kind as StopResult['result'], ...(message ? { message } : {}) });
      }
      return { ok: true, results };
    },
  };
}
export const windowsProcessTools = createWindowsProcessTools();

// ---- 監視役が結果を書かずに終わったときの後片付け ----

type TreeCleanup = (pid: number, spawned: { from: number; to: number } | undefined, observedAt: number) => CleanupReport;
let cleanupOverride: TreeCleanup | undefined;
/** 試験で、子孫の後片付けを差し替える（停止を確認できない場合を POSIX でも確かめるため）。undefined で元に戻す */
export function setTreeCleanupForTest(cleanup: TreeCleanup | undefined): void { cleanupOverride = cleanup; }

/**
 * 監視役が結果を書かずに終わったときに、監視役から先に受け取った PID で対象の子孫を止め、停止を確認できたかを返す（REQ-181・REQ-250・REQ-252・REQ-254）。
 * POSIX は監視役と同じくグループへ SIGTERM を送って 250ms 後に SIGKILL する。Windows は作成時刻と親の PID で識別して、10 秒までに止める
 */
function stopTree(pid: number, spawned: { from: number; to: number } | undefined, observedAt: number): CleanupReport {
  if (cleanupOverride) return cleanupOverride(pid, spawned, observedAt);
  if (process.platform === 'win32') {
    if (!spawned) return { confirmed: false, detail: '対象の起動の時刻を受け取っていないので、対象を識別できません' };
    const target: OrphanTarget = { pid, ...spawned };
    return cleanupWindowsOrphans(target, observedAt, windowsProcessTools);
  }
  try { process.kill(-pid, 'SIGTERM'); } catch (error) { return groupGone(error); }
  if (gone(-pid, 250)) return { confirmed: true, detail: 'グループを止めました' };
  try { process.kill(-pid, 'SIGKILL'); } catch (error) { return groupGone(error); }
  return gone(-pid, 1000) ? { confirmed: true, detail: 'グループを止めました' } : { confirmed: false, detail: `プロセスグループ ${pid} が SIGKILL のあとも残っています` };
}
function groupGone(error: unknown): CleanupReport {
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ESRCH' ? { confirmed: true, detail: 'グループはすでに終わっていました' } : { confirmed: false, detail: `プロセスグループに送れません（${String(code)}）` };
}

/** 監視役が結果を書かずに終わったときの中断を作る。子孫の停止を確認できなければ、その理由を加えて区別する（REQ-250・REQ-254） */
export function missingResultError(
  command: string, stdout: string, stderr: string, ended: string, invalid: boolean, cleanup?: CleanupReport,
): ProcessLimitError {
  const base = invalid ? `監視役の結果を解釈できません（${ended}）` : `監視役が結果を書かずに終了しました（${ended}）`;
  const reason = cleanup && !cleanup.confirmed ? `${base}。子孫の停止を確認できません：${cleanup.detail}` : base;
  return new ProcessLimitError('interrupted', command, stdout, stderr, reason, cleanup);
}

function utf8Prefix(text: string, bytes: number): string {
  return new StringDecoder('utf8').write(Buffer.from(text).subarray(0, bytes));
}
/** 引数を配列のまま渡し、期限・合計出力と子グループを監視する。 */
export function runExternal(command: string, args: readonly string[], options: ExternalOptions = {}): ExternalResult {
  const startedAt = monotonicMs();
  const budget = budgets.getStore();
  if (budget?.state.interrupted) throw new ProcessLimitError('interrupted', command);
  // 品質コマンドは 1 操作の上限を使わず、明示した残り時間と共有予算だけで止める
  const unbounded = options.qualityCommand || options.untilDeadline;
  const requested = options.timeoutMs ?? (unbounded ? Infinity : EXTERNAL_TIMEOUT_MS);
  const perOperation = unbounded ? Infinity : budget?.maxOperationMs ?? EXTERNAL_TIMEOUT_MS;
  const timeout = Math.min(requested, perOperation, budget ? budget.deadline - startedAt : Infinity);
  if (timeout <= 0) throw new ProcessLimitError('timeout', command);
  positive(timeout);
  const maxBuffer = options.maxBuffer ?? EXTERNAL_OUTPUT_BYTES;
  if (!Number.isSafeInteger(maxBuffer) || maxBuffer <= 0) throw new UsageError('外部操作の出力予算は正の安全な整数にしてください');
  const result = spawnSync(process.execPath, [SUPERVISOR, JSON.stringify([command, args, options.shell ?? false, startedAt + timeout, maxBuffer])], {
    cwd: options.cwd, env: options.env, stdio: ['ignore', 'pipe', 'pipe', 'pipe'], maxBuffer: Math.max(maxBuffer, 64 * 1024),
  });
  // 不正なUTF-8の置換で文字列のバイト数が増えても、公開する文字列の合計は予算以内にする。
  // 起動に失敗すると、型に反して stdout・stderr が null になる
  const output = result as { stdout: Buffer | null; stderr: Buffer | null; output: (Buffer | null)[] | null };
  const stdout = utf8Prefix(output.stdout?.toString('utf8') ?? '', maxBuffer);
  const stderr = utf8Prefix(output.stderr?.toString('utf8') ?? '', maxBuffer - Buffer.byteLength(stdout));
  // 監視役の終了を受け取った時刻。これより後に作られたプロセスは、対象の子と確かめられない（REQ-252）
  const observedAt = Date.now();
  const report = readReport(output.output?.[3]?.toString('utf8') ?? '');
  if (result.error) {
    if (report.pid !== undefined && !report.outcome) stopTree(report.pid, report.spawned, observedAt);
    return { status: null, signal: result.signal, stdout, stderr, error: result.error };
  }
  const outcome = report.outcome;
  if (!outcome) {
    // 外からの強制終了（Windows の process.kill(pid, 'SIGINT') など）や異常終了で、監視役が結果を書かなかった。
    // 残った子孫を止め、使い方の誤りではなく理由を含む中断として返し、同じ共有予算の後続の操作を止める（REQ-250）
    // 後片付けの 10 秒は共有予算から引かず、期限も延ばさない。結果によらず、同じ共有予算の後続の操作を止める（REQ-253）
    if (budget) budget.state.interrupted = true;
    const cleanup = report.pid !== undefined ? stopTree(report.pid, report.spawned, observedAt) : undefined;
    const ended = result.signal ? `シグナル ${result.signal}` : `終了コード ${String(result.status)}`;
    throw missingResultError(command, stdout, stderr, ended, report.invalid, cleanup);
  }
  if (outcome.kind) {
    if (outcome.kind === 'interrupted' && budget) budget.state.interrupted = true;
    throw new ProcessLimitError(outcome.kind, command, stdout, stderr);
  }
  const error = outcome.error && Object.assign(new Error(outcome.error.message), { code: outcome.error.code });
  return { status: outcome.status, signal: outcome.signal, stdout, stderr, ...(error ? { error } : {}) };
}
