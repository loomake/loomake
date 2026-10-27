import { AsyncLocalStorage } from 'node:async_hooks';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
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
// ---- Windows で親のいない子孫の後片付け（Q-04 の A） ----

/**
 * Windows で監視役が結果を書かずに終わったときに、残った対象の子孫を止める（REQ-252・REQ-253・REQ-254）。
 * 監視役は対象の環境変数に実行ごとの印を足す。後片付けは PowerShell を 1 回だけ起動し、印と作成時刻を確かめたのと同じハンドルで止める。
 * どれを止めたか・未確認とするかは、PowerShell の出力から judgeCleanup で決める
 */

/** 後片付け（PowerShell の起動・探索・識別・停止・終了の待機）の合計の上限。通常の共有予算とは別に、後片付けだけに使う（REQ-253） */
export const CLEANUP_LIMIT_MS = 10_000;
/** 探索で、対象の起動より前に作られたプロセスを除くときに見込む、時計の刻みの差 */
export const CLOCK_SLACK_MS = 50;
/** 実行ごとの印を入れる環境変数。値はセミコロンで区切った印の並びで、外側の loomake の印を残したまま足す */
export const SUPERVISOR_MARK_ENV = 'LOOMAKE_SUPERVISOR_MARK';
/** 環境変数の値に印を足す */
export function appendMark(current: string | undefined, mark: string): string {
  return current ? `${current};${mark}` : mark;
}

/** 後片付けの結果。confirmed が false なら、detail に停止を確認できない理由を入れる。detail には各手順の時間も残す（REQ-254） */
export type CleanupReport = { confirmed: boolean; detail: string };
/** 監視役から受け取った対象の PID と、親が作った印と、監視役が対象を起動する直前の時刻（Unix 時刻のミリ秒） */
export type CleanupTarget = { pid: number; mark: string; from: number };
export type CleanupState = 'marked' | 'other-mark' | 'no-mark' | 'unreadable' | 'replaced' | 'exited';
/** PowerShell が出す、プロセスごとの記録。created は FILETIME の文字列 */
export type CleanupRecord = {
  pid: number; ppid: number; created: string; parentGone: boolean; state: CleanupState; reason?: string; bits?: number; opens: number;
  handle?: number; stopHandle?: number; waitHandle?: number; action?: 'terminated' | 'failed'; wait?: string;
};
export type CleanupTiming = { define: number; enumerate: number; identify: number; stop: number; wait: number; total: number };
export type CleanupOutput = { unsupported?: string; records: CleanupRecord[]; timing?: CleanupTiming; timedOut: boolean; passes?: number };
export type ToolFailure = { ok: false; timedOut: boolean; message: string };
/** PowerShell のスクリプトを、上限の時間まで動かす。試験で差し替えられる */
export type PowerShellRunner = (file: string, timeoutMs: number, env?: NodeJS.ProcessEnv) => { ok: true; stdout: string } | ToolFailure;
/** 試験で、探索の代わりに与える候補 */
export type CleanupCandidate = { pid: number; created: string };

const CLEANUP_SCRIPT = fileURLToPath(new URL('../../supervisor/windows-cleanup.ps1', import.meta.url));
const STATES: readonly CleanupState[] = ['marked', 'other-mark', 'no-mark', 'unreadable', 'replaced', 'exited'];

/** PowerShell の出力を読む。読めない行は飛ばす */
export function parseCleanupOutput(stdout: string): CleanupOutput {
  const output: CleanupOutput = { records: [], timedOut: false };
  for (const line of stdout.split(/\r?\n/)) {
    let value: unknown;
    try { value = JSON.parse(line); } catch { continue; }
    if (value === null || typeof value !== 'object') continue;
    const item = value as Record<string, unknown>;
    if (item.kind === 'unsupported') output.unsupported = String(item.reason);
    else if (item.kind === 'timing') {
      output.timing = item.timing as CleanupTiming;
      output.timedOut = item.timedOut === true;
      output.passes = Number(item.passes);
    } else if (item.kind === 'process' && Number.isSafeInteger(item.pid) && STATES.includes(item.state as CleanupState)) {
      output.records.push(item as unknown as CleanupRecord);
    }
  }
  return output;
}

const REASONS: Record<string, string> = {
  'open:5': '権限不足で開けません',
  'env-too-large': '環境変数の終わりが 1 MiB 以内にありません',
  'wow64-query': 'WOW64 かどうかを読めません',
  'peb-query': 'PEB の位置を読めません',
  'terminate:5': '権限不足で止められません',
};
/** PowerShell が返した理由の符号を、利用者に見せる文にする */
export function describeReason(reason: string | undefined): string {
  if (!reason) return '理由は分かりません';
  const known = REASONS[reason];
  if (known) return known;
  const [code = '', ...rest] = reason.split(':');
  const detail = rest.length ? rest.join(':') : undefined;
  const label: Record<string, string | undefined> = { open: '開けません', 'env-read': '環境変数を読めません', 'params-read': 'PEB から環境変数の位置を読めません', terminate: '止められません', 'unsupported-arch': '対応しない環境です' };
  const text = label[code];
  if (!text || detail === undefined) return reason;
  return `${text}（${code === 'unsupported-arch' ? 'PROCESSOR_ARCHITECTURE=' : 'エラー '}${detail}）`;
}

/**
 * どれを止めたか、どれを未確認とするかを決める（REQ-252・REQ-254）。
 * 子孫の可能性があるのは、親の PID が対象の PID か印を持つプロセスの PID のプロセスと、親がもういないプロセスで印を確かめられないもの。
 * 子孫の可能性があり、印がない・別の印・読めないものは、止めずに未確認とする
 */
export function judgeCleanup(target: CleanupTarget, output: CleanupOutput): { confirmed: boolean; stopped: number; problems: string[] } {
  const problems: string[] = [];
  if (output.unsupported) return { confirmed: false, stopped: 0, problems: [`印を確かめられないので、何も止めていません：${describeReason(output.unsupported)}`] };
  const marked = new Set(output.records.filter((r) => r.state === 'marked').map((r) => r.pid));
  let stopped = 0;
  for (const r of output.records) {
    if (r.state === 'marked') {
      if (r.action === 'terminated' && r.wait === 'exited') stopped++;
      else if (r.action === 'failed') problems.push(`PID ${r.pid} は${describeReason(r.reason)}`);
      else problems.push(`PID ${r.pid} は後片付けの上限までに終わりません`);
      continue;
    }
    if (r.state === 'replaced' || r.state === 'exited') continue;
    const related = r.ppid === target.pid || marked.has(r.ppid);
    if (!related && !(r.parentGone && r.state === 'unreadable')) continue;
    if (r.state === 'unreadable') problems.push(`PID ${r.pid} は印を確かめられないので止めていません（${describeReason(r.reason)}）`);
    else problems.push(`PID ${r.pid} は${r.state === 'other-mark' ? '別の実行の印' : '印'}${r.state === 'other-mark' ? 'を持つ' : 'がない'}ので止めていません（親の PID ${r.ppid}）`);
  }
  if (output.timedOut) problems.push('後片付けの上限に達したので、調べ終えていないプロセスがあります');
  return { confirmed: problems.length === 0, stopped, problems };
}

/**
 * PowerShell の起動から探索・識別・停止・待機までを、合わせて limitMs（既定 10 秒）までに行う（REQ-252・REQ-253・REQ-254）。
 * PowerShell には残り時間を上限として渡し、中には壁時計の期限を渡す。候補の数によって期限を延ばさない
 */
export function cleanupWindowsOrphans(
  target: CleanupTarget,
  run: PowerShellRunner = runPowerShell,
  options: { clock?: () => number; wall?: () => number; limitMs?: number; candidates?: CleanupCandidate[] } = {},
): CleanupReport {
  const clock = options.clock ?? monotonicMs;
  const limitMs = options.limitMs ?? CLEANUP_LIMIT_MS;
  const started = clock();
  const input = {
    mark: target.mark, targetPid: target.pid, fromMs: target.from, slackMs: CLOCK_SLACK_MS,
    deadlineMs: (options.wall ?? Date.now)() + limitMs, maxPasses: 3, ...(options.candidates ? { candidates: options.candidates } : {}),
  };
  const result = run(CLEANUP_SCRIPT, limitMs, { LOOMAKE_CLEANUP_INPUT: JSON.stringify(input) });
  const elapsed = Math.round(clock() - started);
  if (!result.ok) {
    return result.timedOut
      ? { confirmed: false, detail: `後片付けの上限（${limitMs / 1000} 秒）に達しました（合計 ${elapsed}ms）` }
      : { confirmed: false, detail: `子孫を探せません：${result.message}（合計 ${elapsed}ms）` };
  }
  const output = parseCleanupOutput(result.stdout);
  const judged = judgeCleanup(target, output);
  const t = output.timing;
  const spent = t
    ? `PowerShell の起動 ${Math.max(0, Math.round(elapsed - t.total))}ms、宣言 ${t.define}ms、探索 ${t.enumerate}ms、識別 ${t.identify}ms、停止 ${t.stop}ms、待機 ${t.wait}ms、合計 ${elapsed}ms`
    : `合計 ${elapsed}ms`;
  if (!output.unsupported && !t) return { confirmed: false, detail: `後片付けの結果を読めません（${spent}）` };
  if (!judged.confirmed) return { confirmed: false, detail: `${judged.problems.join('、')}（${spent}）` };
  return { confirmed: true, detail: `${judged.stopped ? `印のあるプロセス ${judged.stopped} 個を止めました` : '止めるプロセスはありませんでした'}（${spent}）` };
}

/** Windows PowerShell 5.1 でスクリプトのファイルを動かす */
export function runPowerShell(file: string, timeoutMs: number, env?: NodeJS.ProcessEnv, executable = 'powershell.exe'): { ok: true; stdout: string } | ToolFailure {
  if (timeoutMs <= 0) return { ok: false, timedOut: true, message: '時間がありません' };
  const result = spawnSync(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], {
    encoding: 'utf8', timeout: Math.ceil(timeoutMs), killSignal: 'SIGKILL', windowsHide: true, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, ...env },
  });
  const error: NodeJS.ErrnoException | undefined = result.error;
  if (error) return { ok: false, timedOut: error.code === 'ETIMEDOUT', message: error.message };
  if (result.status !== 0) return { ok: false, timedOut: false, message: `PowerShell の終了コード ${String(result.status)}：${(result.stderr || '').trim().split(/\r?\n/)[0] ?? ''}` };
  return { ok: true, stdout: result.stdout };
}

// ---- 監視役が結果を書かずに終わったときの後片付け ----

type TreeCleanup = (pid: number, spawned: { from: number; to: number } | undefined, mark: string) => CleanupReport;
let cleanupOverride: TreeCleanup | undefined;
/** 試験で、子孫の後片付けを差し替える（停止を確認できない場合を POSIX でも確かめるため）。undefined で元に戻す */
export function setTreeCleanupForTest(cleanup: TreeCleanup | undefined): void { cleanupOverride = cleanup; }

/**
 * 監視役が結果を書かずに終わったときに、監視役から先に受け取った PID で対象の子孫を止め、停止を確認できたかを返す（REQ-181・REQ-250・REQ-252・REQ-254）。
 * POSIX は監視役と同じくグループへ SIGTERM を送って 250ms 後に SIGKILL する。Windows は印で識別して、PowerShell の起動を含めて 10 秒までに止める
 */
function stopTree(pid: number, spawned: { from: number; to: number } | undefined, mark: string): CleanupReport {
  if (cleanupOverride) return cleanupOverride(pid, spawned, mark);
  if (process.platform === 'win32') {
    if (!spawned) return { confirmed: false, detail: '対象の起動の時刻を受け取っていないので、対象を識別できません' };
    return cleanupWindowsOrphans({ pid, mark, from: spawned.from });
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
  // 監視役が結果を書かずに終わったときに、対象の子孫を識別する実行ごとの印（REQ-252）。外側の loomake の印は残す
  const mark = randomBytes(16).toString('hex');
  const baseEnv = options.env ?? process.env;
  const env = { ...baseEnv, [SUPERVISOR_MARK_ENV]: appendMark(baseEnv[SUPERVISOR_MARK_ENV], mark) };
  const result = spawnSync(process.execPath, [SUPERVISOR, JSON.stringify([command, args, options.shell ?? false, startedAt + timeout, maxBuffer])], {
    cwd: options.cwd, env, stdio: ['ignore', 'pipe', 'pipe', 'pipe'], maxBuffer: Math.max(maxBuffer, 64 * 1024),
  });
  // 不正なUTF-8の置換で文字列のバイト数が増えても、公開する文字列の合計は予算以内にする。
  // 起動に失敗すると、型に反して stdout・stderr が null になる
  const output = result as { stdout: Buffer | null; stderr: Buffer | null; output: (Buffer | null)[] | null };
  const stdout = utf8Prefix(output.stdout?.toString('utf8') ?? '', maxBuffer);
  const stderr = utf8Prefix(output.stderr?.toString('utf8') ?? '', maxBuffer - Buffer.byteLength(stdout));
  const report = readReport(output.output?.[3]?.toString('utf8') ?? '');
  if (result.error) {
    if (report.pid !== undefined && !report.outcome) stopTree(report.pid, report.spawned, mark);
    return { status: null, signal: result.signal, stdout, stderr, error: result.error };
  }
  const outcome = report.outcome;
  if (!outcome) {
    // 外からの強制終了（Windows の process.kill(pid, 'SIGINT') など）や異常終了で、監視役が結果を書かなかった。
    // 残った子孫を止め、使い方の誤りではなく理由を含む中断として返し、同じ共有予算の後続の操作を止める（REQ-250）
    // 後片付けの 10 秒は共有予算から引かず、期限も延ばさない。結果によらず、同じ共有予算の後続の操作を止める（REQ-253）
    if (budget) budget.state.interrupted = true;
    const cleanup = report.pid !== undefined ? stopTree(report.pid, report.spawned, mark) : undefined;
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
