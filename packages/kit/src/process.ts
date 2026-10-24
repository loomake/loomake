import { AsyncLocalStorage } from 'node:async_hooks';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { StringDecoder } from 'node:string_decoder';
import { UsageError } from './errors.js';

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
  return budgets.run({ deadline: Math.min(performance.now() + options.timeoutMs, outer?.deadline ?? Infinity), maxOperationMs, state: outer?.state ?? { interrupted: false } }, action);
}
export function remainingProcessTime(): number | undefined {
  const budget = budgets.getStore();
  return budget && Math.max(0, budget.deadline - performance.now());
}
export function hasProcessBudget(): boolean { return budgets.getStore() !== undefined; }

export type ProcessLimitKind = 'timeout' | 'output' | 'interrupted';
export class ProcessLimitError extends UsageError {
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
};
export type ExternalResult = { status: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string; error?: NodeJS.ErrnoException };
type Outcome = { status: number | null; signal: NodeJS.Signals | null; kind?: ProcessLimitKind; error?: { message: string; code?: string } };

// 監視対象の出力と制御情報を別のpipeに流し、コマンド自身の出力を結果の形式と解釈しない。
const SUPERVISOR = String.raw`
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const [command,args,shell,ms,limit]=JSON.parse(process.argv[1]);
const win=process.platform==='win32';
let child, timer, grace, count=0, stopping=false, ended=false;
let outcome={status:null,signal:null};
function kill(signal) {
  if (!child || !child.pid) return;
  if (win) { spawnSync('taskkill',['/pid',String(child.pid),'/T','/F'],{stdio:'ignore',timeout:1000,killSignal:'SIGKILL'}); }
  else { try {process.kill(-child.pid,signal);} catch {} }
}
function finish() {
  if(ended) return;
  ended=true; clearTimeout(timer); clearTimeout(grace);
  let pending=2;
  const flushed=()=>{if(--pending===0){fs.writeSync(3,JSON.stringify(outcome));process.exit(0);}};
  process.stdout.end(flushed);process.stderr.end(flushed);
}
function stop(kind) {
  if(stopping || ended) return;
  stopping=true; outcome.kind=kind; clearTimeout(timer);
  kill('SIGTERM');
  grace=setTimeout(()=>{kill('SIGKILL');finish();},250);
}
process.on('SIGINT',()=>stop('interrupted'));
process.on('SIGTERM',()=>stop('interrupted'));
try {
  child=spawn(command,args,{shell,stdio:['ignore','pipe','pipe'],detached:!win});
  const forward=(target,data)=>{
    if(stopping) return;
    const room=Math.max(0,limit-count);
    const part=data.subarray(0,room);
    if(part.length) target.write(part);
    count+=data.length;
    if(count>limit) stop('output');
  };
  child.stdout.on('data',data=>forward(process.stdout,data));
  child.stderr.on('data',data=>forward(process.stderr,data));
  child.on('error',error=>{outcome.error={message:error.message,code:error.code};finish();});
  child.on('exit',(status,signal)=>{
    outcome.status=status;outcome.signal=signal;
    if(!stopping) {kill('SIGKILL');}
  });
  child.on('close',()=>{if(!stopping) finish();});
  // closeが来なくても、通常終了後のグループを片付けて待機を終える。
  child.on('exit',()=>{if(!stopping) grace=setTimeout(finish,250);});
  timer=setTimeout(()=>stop('timeout'),ms);
} catch(error) {outcome.error={message:error.message,code:error.code};finish();}
`;

function utf8Prefix(text: string, bytes: number): string {
  return new StringDecoder('utf8').write(Buffer.from(text).subarray(0, bytes));
}
/** 引数を配列のまま渡し、期限・合計出力と子グループを監視する。 */
export function runExternal(command: string, args: readonly string[], options: ExternalOptions = {}): ExternalResult {
  const budget = budgets.getStore();
  if (budget?.state.interrupted) throw new ProcessLimitError('interrupted', command);
  const timeout = Math.min(options.timeoutMs ?? (options.qualityCommand ? Infinity : EXTERNAL_TIMEOUT_MS), options.qualityCommand ? Infinity : budget?.maxOperationMs ?? EXTERNAL_TIMEOUT_MS, budget ? budget.deadline - performance.now() : Infinity);
  if (timeout <= 0) throw new ProcessLimitError('timeout', command);
  positive(timeout);
  const maxBuffer = options.maxBuffer ?? EXTERNAL_OUTPUT_BYTES;
  if (!Number.isSafeInteger(maxBuffer) || maxBuffer <= 0) throw new UsageError('外部操作の出力予算は正の安全な整数にしてください');
  const result = spawnSync(process.execPath, ['-e', SUPERVISOR, JSON.stringify([command, args, options.shell ?? false, Math.ceil(timeout), maxBuffer])], {
    cwd: options.cwd, env: options.env, stdio: ['ignore', 'pipe', 'pipe', 'pipe'], maxBuffer: Math.max(maxBuffer, 64 * 1024),
  });
  // 不正なUTF-8の置換で文字列のバイト数が増えても、公開する文字列の合計は予算以内にする。
  const stdout = utf8Prefix(result.stdout?.toString('utf8') ?? '', maxBuffer);
  const stderr = utf8Prefix(result.stderr?.toString('utf8') ?? '', maxBuffer - Buffer.byteLength(stdout));
  if (result.error) return { status: null, signal: result.signal, stdout, stderr, error: result.error };
  let outcome: Outcome;
  try { outcome = JSON.parse(result.output[3]?.toString('utf8') ?? ''); }
  catch { throw new UsageError(`外部操作の監視結果を読み取れません：${command}`); }
  if (outcome.kind) {
    if (outcome.kind === 'interrupted' && budget) budget.state.interrupted = true;
    throw new ProcessLimitError(outcome.kind, command, stdout, stderr);
  }
  const error = outcome.error && Object.assign(new Error(outcome.error.message), { code: outcome.error.code });
  return { status: outcome.status, signal: outcome.signal, stdout, stderr, ...(error ? { error } : {}) };
}
