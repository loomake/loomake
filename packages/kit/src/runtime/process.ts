import { AsyncLocalStorage } from 'node:async_hooks';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';
import { RuntimeFailure, UsageError } from './errors.js';

export const EXTERNAL_TIMEOUT_MS = 30_000;
export const EXTERNAL_OUTPUT_BYTES = 64 * 1024 * 1024;
type Budget = { deadline: number; maxOperationMs: number; state: { interrupted: boolean } };
const budgets = new AsyncLocalStorage<Budget>();
export type ProcessBudget = { timeoutMs: number; maxOperationMs?: number };

function positive(value: number) {
  if (!Number.isFinite(value) || value <= 0) throw new UsageError('外部操作の予算は正の有限数にしてください');
}
/** コールバックとその非同期処理だけへ期限を伝える。ネストで期限を延ばさない。 */
export function withProcessBudget<T>(options: ProcessBudget, action: () => T): T {
  positive(options.timeoutMs);
  const outer = budgets.getStore();
  const maxOperationMs = Math.min(options.maxOperationMs ?? EXTERNAL_TIMEOUT_MS, outer?.maxOperationMs ?? Infinity);
  positive(maxOperationMs);
  const deadline = Math.min(performance.now() + options.timeoutMs, outer?.deadline ?? Infinity);
  return budgets.run({ deadline, maxOperationMs, state: outer?.state ?? { interrupted: false } }, action);
}
export function remainingProcessTime(): number | undefined {
  const budget = budgets.getStore();
  return budget && Math.max(0, budget.deadline - performance.now());
}
export function hasProcessBudget(): boolean { return budgets.getStore() !== undefined; }

export type ProcessLimitKind = 'timeout' | 'output' | 'interrupted';
export class ProcessLimitError extends RuntimeFailure {
  constructor(readonly kind: ProcessLimitKind, command: string, readonly stdout = '', readonly stderr = '') {
    super(`外部操作を止めました：${command}（${kind === 'timeout' ? '実行時間の上限に達しました' : kind === 'output' ? '出力の上限に達しました' : '中断されました'}）`);
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

function utf8Prefix(text: string, bytes: number): string {
  return new StringDecoder('utf8').write(Buffer.from(text).subarray(0, bytes));
}
/** 引数を配列のまま渡し、期限・合計出力と子グループを監視する。 */
export function runExternal(command: string, args: readonly string[], options: ExternalOptions = {}): ExternalResult {
  const budget = budgets.getStore();
  if (budget?.state.interrupted) throw new ProcessLimitError('interrupted', command);
  // 品質コマンドは 1 操作の上限を使わず、明示した残り時間と共有予算だけで止める
  const unbounded = options.qualityCommand || options.untilDeadline;
  const requested = options.timeoutMs ?? (unbounded ? Infinity : EXTERNAL_TIMEOUT_MS);
  const perOperation = unbounded ? Infinity : budget?.maxOperationMs ?? EXTERNAL_TIMEOUT_MS;
  const timeout = Math.min(requested, perOperation, budget ? budget.deadline - performance.now() : Infinity);
  if (timeout <= 0) throw new ProcessLimitError('timeout', command);
  positive(timeout);
  const maxBuffer = options.maxBuffer ?? EXTERNAL_OUTPUT_BYTES;
  if (!Number.isSafeInteger(maxBuffer) || maxBuffer <= 0) throw new UsageError('外部操作の出力予算は正の安全な整数にしてください');
  const result = spawnSync(process.execPath, [SUPERVISOR, JSON.stringify([command, args, options.shell ?? false, Math.ceil(timeout), maxBuffer])], {
    cwd: options.cwd, env: options.env, stdio: ['ignore', 'pipe', 'pipe', 'pipe'], maxBuffer: Math.max(maxBuffer, 64 * 1024),
  });
  // 不正なUTF-8の置換で文字列のバイト数が増えても、公開する文字列の合計は予算以内にする。
  // 起動に失敗すると、型に反して stdout・stderr が null になる
  const output = result as { stdout: Buffer | null; stderr: Buffer | null };
  const stdout = utf8Prefix(output.stdout?.toString('utf8') ?? '', maxBuffer);
  const stderr = utf8Prefix(output.stderr?.toString('utf8') ?? '', maxBuffer - Buffer.byteLength(stdout));
  if (result.error) return { status: null, signal: result.signal, stdout, stderr, error: result.error };
  let outcome: Outcome;
  try { outcome = JSON.parse(result.output[3]?.toString('utf8') ?? '') as Outcome; }
  catch { throw new UsageError(`外部操作の監視結果を読み取れません：${command}`); }
  if (outcome.kind) {
    if (outcome.kind === 'interrupted' && budget) budget.state.interrupted = true;
    throw new ProcessLimitError(outcome.kind, command, stdout, stderr);
  }
  const error = outcome.error && Object.assign(new Error(outcome.error.message), { code: outcome.error.code });
  return { status: outcome.status, signal: outcome.signal, stdout, stderr, ...(error ? { error } : {}) };
}
