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
  constructor(readonly kind: ProcessLimitKind, command: string, readonly stdout = '', readonly stderr = '', readonly reason?: string) {
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

/** 監視役が fd 3 に書いた、対象の PID の行と結果。解釈できない行があれば invalid にする */
function readReport(text: string): { pid?: number; outcome?: Outcome; invalid: boolean } {
  let pid: number | undefined;
  let outcome: Outcome | undefined;
  let invalid = false;
  for (const line of text.split('\n')) {
    if (!line) continue;
    let value: unknown;
    try { value = JSON.parse(line); } catch { invalid = true; continue; }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid = true;
    else if ('status' in value) outcome = value as Outcome;
    else if ('pid' in value && Number.isSafeInteger(value.pid) && (value.pid as number) > 0) pid = value.pid as number;
    else invalid = true;
  }
  return { pid, outcome, invalid };
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
/**
 * 監視役が結果を書かずに終わったときに、監視役から先に受け取った PID で対象の子孫を止める（REQ-181・REQ-250）。
 * 監視役と同じく、POSIX はグループへ SIGTERM を送って 250ms 後に SIGKILL し、Windows は taskkill を 1 秒までに制限する
 */
function stopTree(pid: number): void {
  if (process.platform === 'win32') {
    const t0 = monotonicMs();
    const probe = spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL', windowsHide: true });
    const list = spawnSync('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*send-sigint*" } | ForEach-Object { "{0} {1} {2}" -f $_.ProcessId, $_.ParentProcessId, $_.CommandLine }'], { encoding: 'utf8', windowsHide: true });
    process.stderr.write(`PROBE taskkill pid=${pid} ms=${Math.round(monotonicMs() - t0)} status=${String(probe.status)} signal=${String(probe.signal)} error=${String(probe.error)} out=${JSON.stringify(probe.stdout)} err=${JSON.stringify(probe.stderr)} left=${JSON.stringify(list.stdout)}\n`);
    // taskkill が返っても、止めたプロセスの終了は少し遅れることがあるので、消えるまで最大 1 秒待つ
    gone(pid, 1000);
    return;
  }
  try { process.kill(-pid, 'SIGTERM'); } catch { return; }
  if (gone(-pid, 250)) return;
  try { process.kill(-pid, 'SIGKILL'); } catch { return; }
  gone(-pid, 1000);
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
  const report = readReport(output.output?.[3]?.toString('utf8') ?? '');
  if (result.error) {
    if (report.pid !== undefined && !report.outcome) stopTree(report.pid);
    return { status: null, signal: result.signal, stdout, stderr, error: result.error };
  }
  const outcome = report.outcome;
  if (!outcome) {
    // 外からの強制終了（Windows の process.kill(pid, 'SIGINT') など）や異常終了で、監視役が結果を書かなかった。
    // 残った子孫を止め、使い方の誤りではなく理由を含む中断として返し、同じ共有予算の後続の操作を止める（REQ-250）
    if (report.pid !== undefined) stopTree(report.pid);
    if (budget) budget.state.interrupted = true;
    const ended = result.signal ? `シグナル ${result.signal}` : `終了コード ${String(result.status)}`;
    const reason = report.invalid ? `監視役の結果を解釈できません（${ended}）` : `監視役が結果を書かずに終了しました（${ended}）`;
    throw new ProcessLimitError('interrupted', command, stdout, stderr, reason);
  }
  if (outcome.kind) {
    if (outcome.kind === 'interrupted' && budget) budget.state.interrupted = true;
    throw new ProcessLimitError(outcome.kind, command, stdout, stderr);
  }
  const error = outcome.error && Object.assign(new Error(outcome.error.message), { code: outcome.error.code });
  return { status: outcome.status, signal: outcome.signal, stdout, stderr, ...(error ? { error } : {}) };
}
