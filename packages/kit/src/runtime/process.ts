import { AsyncLocalStorage } from 'node:async_hooks';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';
import { RuntimeFailure, UsageError } from './errors.js';

export const EXTERNAL_TIMEOUT_MS = 30_000;
export const EXTERNAL_OUTPUT_BYTES = 64 * 1024 * 1024;
type Budget = { deadline: number; maxOperationMs: number; state: { interrupted: boolean } };
const budgets = new AsyncLocalStorage<Budget>();
export type ProcessBudget = { timeoutMs: number; maxOperationMs?: number };
const monotonicMs = () => Number(process.hrtime.bigint()) / 1_000_000;
/** 保持役の準備を待った時間の合計。操作の期限にも共有予算にも含めないので、期限を計る時計から差し引く（REQ-257） */
let holderWaitMs = 0;
const budgetNow = () => monotonicMs() - holderWaitMs;
/** このプロセスで保持役の準備を待った時間（ミリ秒）。run の記録の期限のように実時間で計る期限から差し引く（REQ-257） */
export function holderWaitTime(): number { return holderWaitMs; }

function positive(value: number) {
  if (!Number.isFinite(value) || value <= 0) throw new UsageError('外部操作の予算は正の有限数にしてください');
}
/** コールバックとその非同期処理だけへ期限を伝える。ネストで期限を延ばさない。 */
export function withProcessBudget<T>(options: ProcessBudget, action: () => T): T {
  positive(options.timeoutMs);
  const outer = budgets.getStore();
  const maxOperationMs = Math.min(options.maxOperationMs ?? EXTERNAL_TIMEOUT_MS, outer?.maxOperationMs ?? Infinity);
  positive(maxOperationMs);
  const deadline = Math.min(budgetNow() + options.timeoutMs, outer?.deadline ?? Infinity);
  return budgets.run({ deadline, maxOperationMs, state: outer?.state ?? { interrupted: false } }, action);
}
export function remainingProcessTime(): number | undefined {
  const budget = budgets.getStore();
  return budget && Math.max(0, budget.deadline - budgetNow());
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

/**
 * 監視役が fd 3 に書いた、対象の識別の行と結果を読む（REQ-250・REQ-252）。
 * 行は、対象を起動する直前の {"spawning":true}、起動した直後の {"pid"}（保持を確かめたら "created"、確かめられなければ "unprotected" も持つ）、結果の順。解釈できない行があれば invalid にする
 */
export function readReport(text: string): { target: SupervisorTarget; outcome?: Outcome; invalid: boolean } {
  const target: SupervisorTarget = { spawning: false };
  let outcome: Outcome | undefined;
  let invalid = false;
  for (const line of text.split('\n')) {
    if (!line) continue;
    let value: unknown;
    try { value = JSON.parse(line); } catch { invalid = true; continue; }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) { invalid = true; continue; }
    const item = value as Record<string, unknown>;
    if ('status' in item) outcome = item as unknown as Outcome;
    else if (item.spawning === true) target.spawning = true;
    else if (Number.isSafeInteger(item.pid) && (item.pid as number) > 0) {
      target.pid = item.pid as number;
      if (typeof item.created === 'string' && /^\d+$/.test(item.created)) target.created = item.created;
      else if (typeof item.unprotected === 'string') target.unprotected = item.unprotected;
    } else invalid = true;
  }
  return { target, outcome, invalid };
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
// ---- Windows の保持役（Q-05 の B-3） ----

/**
 * Windows で監視役が結果を書かずに終わったときに、残った対象の子孫を止めるための保持役（REQ-252・REQ-253・REQ-255・REQ-256）。
 * loomake のプロセスごとに 1 つ起動して使い回し、監視役が対象を起動した直後に名前つきパイプで対象のハンドルの保持を頼む。
 * 後片付けも保持役が行う。どれを未確認とするかは、保持役の結果から judgeHolderCleanup で決める
 */

/** 後片付け（保持役への依頼・探索・識別・停止・終了の待機）の合計の上限。通常の共有予算とは別に、後片付けだけに使う（REQ-253） */
export const CLEANUP_LIMIT_MS = 10_000;
/** 保持役の準備を待つ上限。loomake のプロセスごとに最初の外部操作の前に一度だけ待ち、操作の期限にも共有予算にも含めない（REQ-257） */
export const HOLDER_START_LIMIT_MS = 10_000;
/** 保持の期限に足す、監視役の停止の猶予（250ms と 1 秒の待機と出力の書き出し）と余裕（REQ-255） */
const SUPERVISOR_STOP_GRACE_MS = 2_000;
const HOLD_MARGIN_MS = 5_000;

/** 保持の期限（壁時計の Unix 時刻のミリ秒）。対象の期限に、監視役の停止の猶予と後片付けの上限と余裕を足す（REQ-255） */
export function holdExpiry(wallNow: number, targetTimeoutMs: number): number {
  return wallNow + targetTimeoutMs + SUPERVISOR_STOP_GRACE_MS + CLEANUP_LIMIT_MS + HOLD_MARGIN_MS;
}

/** 後片付けの結果。confirmed が false なら、detail に停止を確認できない理由を入れる。detail には各手順の時間も残す（REQ-254） */
export type CleanupReport = { confirmed: boolean; detail: string };
/** 保持役が返す、プロセスごとの記録。created は FILETIME の文字列 */
export type HolderRecord = {
  pid: number; ppid?: number; created?: string; listed?: string; state: 'descendant' | 'same-tick' | 'replaced' | 'unopenable';
  reason?: string; pass?: number; opens: number; access?: 'full' | 'limited';
  handle?: number; stopHandle?: number; waitHandle?: number; action?: 'terminated' | 'failed' | 'skipped'; wait?: string;
};
export type HolderCleanupOutput = {
  target?: 'held' | 'mismatch' | 'no-hold'; passes?: number; stable?: boolean; error?: string;
  records?: HolderRecord[]; timing?: { enumerate: number; stop: number; wait: number; total: number };
};
/** 親から保持役への後片付けの頼み。candidates は試験で探索の代わりに与える候補 */
export type HolderCleanupRequest = { id: string; pid: number; created: string; candidates?: { pid: number; created?: string }[] };
/** 保持役の結果。届かなければ failure に理由を入れる */
export type HolderReply = { output: HolderCleanupOutput; elapsedMs: number } | { failure: string; elapsedMs: number };
/** 保持役とのやりとり。試験で差し替えられる */
export type HolderClient = {
  /** 保持役の準備を、waitMs まで同期で待つ。準備できればパイプのパスを返す */
  prepare(waitMs: number): { pipe: string } | { unavailable: string };
  /** その対象の保持の解放を頼む。結果は待たない */
  release(id: string): void;
  /** 後片付けを頼み、limitMs まで同期で結果を待つ */
  cleanup(request: HolderCleanupRequest, limitMs: number): HolderReply;
};

const HOLDER_SCRIPT = fileURLToPath(new URL('../../supervisor/windows-holder.ps1', import.meta.url));
const POWERSHELL_ARGS = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', HOLDER_SCRIPT];
type HolderProcess = { child: ChildProcess; dir: string; name: string; seq: number };
// 試験のように同じプロセスでこのモジュールが何度も読まれても、保持役は 1 つにする
const HOLDER_KEY = Symbol.for('loomake.windowsHolder');
const holderSlot = (): { current?: HolderProcess } => {
  const store = globalThis as unknown as Record<symbol, { current?: HolderProcess } | undefined>;
  return (store[HOLDER_KEY] ??= {});
};
function processAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM'; }
}
function waitUntil(check: () => boolean, ms: number): boolean {
  const until = monotonicMs() + ms;
  for (;;) {
    if (check()) return true;
    if (monotonicMs() >= until) return false;
    pause(5);
  }
}

function startHolder(): HolderProcess {
  const dir = mkdtempSync(join(tmpdir(), 'loomake-holder-'));
  const name = `loomake-holder-${randomBytes(16).toString('hex')}`;
  // stdin はパイプにして、親が終わったことを保持役が EOF で知る。親のイベントループを保持役のために止めない
  const child = spawn('powershell.exe', POWERSHELL_ARGS, {
    stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true, env: { ...process.env, LOOMAKE_HOLDER_DIR: dir, LOOMAKE_HOLDER_PIPE: name },
  });
  child.on('error', () => { /* 起動に失敗したら、準備ができないこととして扱う */ });
  child.stdin.on('error', () => { /* 保持役が先に終わっても、親を止めない */ });
  child.unref();
  (child.stdin as unknown as { unref?: () => void } | null)?.unref?.();
  return { child, dir, name, seq: 0 };
}

function requestFile(holder: HolderProcess, body: object): string {
  const n = ++holder.seq;
  const tmp = join(holder.dir, `tmp-${n}`);
  writeFileSync(tmp, JSON.stringify(body));
  renameSync(tmp, join(holder.dir, `req-${n}.json`));
  return join(holder.dir, `res-${n}.json`);
}

/** Windows の既定の保持役 */
export const windowsHolder: HolderClient = {
  prepare(waitMs) {
    const slot = holderSlot();
    if (!slot.current || !processAlive(slot.current.child.pid)) slot.current = startHolder();
    const holder = slot.current;
    if (!holder.child.pid) return { unavailable: 'holder-spawn' };
    const ready = join(holder.dir, 'ready');
    if (!waitUntil(() => existsSync(ready), Math.max(0, waitMs))) return { unavailable: processAlive(holder.child.pid) ? 'holder-not-ready' : 'holder-exited' };
    return { pipe: `\\\\.\\pipe\\${holder.name}` };
  },
  release(id) {
    const holder = holderSlot().current;
    if (!holder || !processAlive(holder.child.pid)) return;
    try { requestFile(holder, { op: 'release', id }); } catch { /* 解放できなくても、保持は期限で解放される */ }
  },
  cleanup(request, limitMs) {
    const started = monotonicMs();
    const holder = holderSlot().current;
    const elapsed = () => Math.round(monotonicMs() - started);
    if (!holder || !processAlive(holder.child.pid)) return { failure: '保持役が終わっています', elapsedMs: elapsed() };
    let res: string;
    try { res = requestFile(holder, { op: 'cleanup', ...request, deadlineMs: Date.now() + limitMs }); }
    catch (error) { return { failure: `保持役に頼めません：${(error as Error).message}`, elapsedMs: elapsed() }; }
    if (!waitUntil(() => existsSync(res), limitMs)) return { failure: `保持役が後片付けの上限（${limitMs / 1000} 秒）までに応答しません`, elapsedMs: elapsed() };
    try { return { output: JSON.parse(readFileSync(res, 'utf8')) as HolderCleanupOutput, elapsedMs: elapsed() }; }
    catch { return { failure: '保持役の結果を読めません', elapsedMs: elapsed() }; }
    finally { try { rmSync(res, { force: true }); } catch { /* 作業用のディレクトリは保持役が終わるときに消す */ } }
  },
};
/** 試験で、保持役が持っている保持の ID の一覧を読む。読めなければ undefined */
export function windowsHolderStateForTest(waitMs = 5_000): string[] | undefined {
  const holder = holderSlot().current;
  if (!holder || !processAlive(holder.child.pid)) return undefined;
  const res = requestFile(holder, { op: 'state' });
  if (!waitUntil(() => existsSync(res), waitMs)) return undefined;
  try { return (JSON.parse(readFileSync(res, 'utf8')) as { holds?: string[] }).holds ?? []; } finally { rmSync(res, { force: true }); }
}
/** 試験で、保持役の stdin を閉じる（親が終わったときと同じ）。保持役の PID を返す */
export function closeWindowsHolderForTest(): number | undefined {
  const slot = holderSlot();
  const holder = slot.current;
  slot.current = undefined;
  holder?.child.stdin?.end();
  return holder?.child.pid;
}
let holderOverride: HolderClient | undefined;
/** 試験で、保持役を差し替える（POSIX でも保持役を使う流れを確かめるため）。undefined で元に戻す */
export function setHolderForTest(client: HolderClient | undefined): void {
  holderOverride = client;
  // 差し替えた保持役でも、最初の外部操作の待ちを確かめられるようにする
  holderGate().waited = false;
}
const currentHolder = (): HolderClient | undefined => holderOverride ?? (process.platform === 'win32' ? windowsHolder : undefined);
// 準備を待ったかどうか。試験のように同じプロセスでこのモジュールが何度も読まれても、一度だけにする
const GATE_KEY = Symbol.for('loomake.windowsHolderGate');
const holderGate = (): { waited: boolean } => {
  const store = globalThis as unknown as Record<symbol, { waited: boolean } | undefined>;
  return (store[GATE_KEY] ??= { waited: false });
};

/**
 * 保持役を使えるようにする。loomake のプロセスごとに最初の 1 回だけ、準備を最大 waitMs（既定は 10 秒）待ち、
 * 待った時間は操作の期限にも共有予算にも含めない。2 回目以降は待たずに、いまの状態だけを見る（REQ-257）
 */
function prepareHolder(holder: HolderClient, waitMs = HOLDER_START_LIMIT_MS): { pipe: string } | { unavailable: string } {
  const gate = holderGate();
  if (gate.waited) return holder.prepare(0);
  gate.waited = true;
  const started = monotonicMs();
  try { return holder.prepare(waitMs); } finally { holderWaitMs += monotonicMs() - started; }
}

/** 試験で、Windows の保持役を先に起動して準備を待つ。最初の外部操作の待ちを済ませたことになる。準備できれば true */
export function prepareWindowsHolder(waitMs = 60_000): boolean {
  if (process.platform !== 'win32') return false;
  return 'pipe' in prepareHolder(windowsHolder, waitMs);
}

const UNPROTECTED: Record<string, string> = {
  'no-holder': '保持役がありません',
  'holder-spawn': '保持役を起動できません',
  'holder-not-ready': '保持役の準備が間に合いません',
  'holder-exited': '保持役が準備の前に終わりました',
  connect: '保持役につなげません',
  'connect-timeout': '保持役につなぐのが間に合いません',
  'no-reply': '保持役の返事が間に合いません',
  'invalid-reply': '保持役の返事を解釈できません',
  disconnected: '保持役との通信が切れました',
  'exited-first': '保持を確かめる前に対象が終わりました',
};
/** 監視役が書いた、保持を確かめられない理由の符号を、利用者に見せる文にする */
export function describeUnprotected(code: string): string {
  if (UNPROTECTED[code]) return UNPROTECTED[code];
  const open = /^open:(.+)$/.exec(code);
  if (open) return open[1] === '87' ? '保持役が対象を開けません（対象はもう終わっています）' : `保持役が対象を開けません（エラー ${open[1]}）`;
  return code;
}

/**
 * 保持役の後片付けの結果から、停止を確認できたかを決める（REQ-252・REQ-253・REQ-254・REQ-256）。
 * 止めるのに失敗しても、識別に使ったのと同じハンドルの待機で終了を確かめられれば、止まったとする（A-05）
 */
export function judgeHolderCleanup(reply: HolderReply): CleanupReport {
  if ('failure' in reply) return { confirmed: false, detail: `${reply.failure}（合計 ${reply.elapsedMs}ms）` };
  const output = reply.output;
  const t = output.timing;
  const spent = t
    ? `探索 ${output.passes ?? 0} 回、探索 ${t.enumerate}ms、停止 ${t.stop}ms、待機 ${t.wait}ms、保持役の中 ${t.total}ms、合計 ${reply.elapsedMs}ms`
    : `合計 ${reply.elapsedMs}ms`;
  if (output.target === 'no-hold') return { confirmed: false, detail: `対象の保持がなく、対象の作成時刻を確かめられないので、何も止めていません（${spent}）` };
  if (output.target === 'mismatch') return { confirmed: false, detail: `対象の作成時刻が監視役から受け取った値と合わないので、何も止めていません（${spent}）` };
  if (output.target !== 'held') return { confirmed: false, detail: `後片付けの結果を読めません${output.error ? `：${output.error}` : ''}（${spent}）` };
  const problems: string[] = [];
  let stopped = 0;
  for (const r of output.records ?? []) {
    if (r.state === 'same-tick') problems.push(`PID ${r.pid} は作成時刻が親（PID ${String(r.ppid)}）と同じで前後を決められないので止めていません`);
    if (r.state !== 'descendant') continue;
    // TERMINATE の権限なしでしか開けなかったものは、終わっていても権限不足として未確認にする（A-05）
    if (r.action === 'skipped') { problems.push(`PID ${r.pid} は権限不足で止められません`); continue; }
    if (r.wait === 'exited') { stopped++; continue; }
    if (r.action === 'failed') problems.push(`PID ${r.pid} は止められず（${String(r.reason)}）、終了も確かめられません`);
    else problems.push(`PID ${r.pid} は後片付けの上限までに終わりません`);
  }
  if (output.error) problems.push(`プロセスの一覧を取得できません（${output.error}）`);
  else if (!output.stable) problems.push('後片付けの上限に達したので、探し終えていません');
  if (problems.length) return { confirmed: false, detail: `${problems.join('、')}（${spent}）` };
  return { confirmed: true, detail: `${stopped ? `子孫 ${stopped} 個を止めました` : '止める子孫はありませんでした'}（${spent}）` };
}

// ---- 監視役が結果を書かずに終わったときの後片付け ----

/** 監視役が fd 3 に書いた、対象の識別の情報 */
export type SupervisorTarget = { spawning: boolean; pid?: number; created?: string; unprotected?: string };
type TreeCleanup = (target: SupervisorTarget & { pid: number }) => CleanupReport;
let cleanupOverride: TreeCleanup | undefined;
/** 試験で、子孫の後片付けを差し替える（停止を確認できない場合を POSIX でも確かめるため）。undefined で元に戻す */
export function setTreeCleanupForTest(cleanup: TreeCleanup | undefined): void { cleanupOverride = cleanup; }

/**
 * 監視役が結果を書かずに終わったときに、監視役から先に受け取った PID で対象の子孫を止め、停止を確認できたかを返す（REQ-181・REQ-250・REQ-252・REQ-254）。
 * 保持役を使ったとき（Windows）は、保持を確かめた対象だけを保持役に後片付けさせる。保持役を使わないとき（POSIX）は、監視役と同じくグループへ SIGTERM を送って 250ms 後に SIGKILL する。
 * 対象を起動したが PID を受け取れなかったときは、未確認として返す
 */
export function stopTree(target: SupervisorTarget, holdId: string | undefined, holder: HolderClient | undefined): CleanupReport | undefined {
  if (target.pid === undefined) return target.spawning ? { confirmed: false, detail: '対象を起動したあと、PID を受け取る前に監視役が終わりました' } : undefined;
  const pid = target.pid;
  if (cleanupOverride) return cleanupOverride({ ...target, pid });
  if (holder && holdId !== undefined) {
    if (target.created === undefined) {
      holder.release(holdId);
      return { confirmed: false, detail: `保持を確かめられないので、何も止めていません：${describeUnprotected(target.unprotected ?? 'no-holder')}` };
    }
    // 保持役は、保持したまま後片付けを行い、終えてから解放する（REQ-255）
    return judgeHolderCleanup(holder.cleanup({ id: holdId, pid, created: target.created }, CLEANUP_LIMIT_MS));
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
  const budget = budgets.getStore();
  if (budget?.state.interrupted) throw new ProcessLimitError('interrupted', command);
  // 品質コマンドは 1 操作の上限を使わず、明示した残り時間と共有予算だけで止める
  const unbounded = options.qualityCommand || options.untilDeadline;
  const requested = options.timeoutMs ?? (unbounded ? Infinity : EXTERNAL_TIMEOUT_MS);
  const perOperation = unbounded ? Infinity : budget?.maxOperationMs ?? EXTERNAL_TIMEOUT_MS;
  const timeLeft = () => Math.min(requested, perOperation, budget ? budget.deadline - budgetNow() : Infinity);
  if (timeLeft() <= 0) throw new ProcessLimitError('timeout', command);
  const maxBuffer = options.maxBuffer ?? EXTERNAL_OUTPUT_BYTES;
  if (!Number.isSafeInteger(maxBuffer) || maxBuffer <= 0) throw new UsageError('外部操作の出力予算は正の安全な整数にしてください');
  // Windows では保持役を使う。最初の外部操作の前に一度だけ準備を待ち、待った時間は期限に含めない（REQ-257）。
  // 準備できなければ保護なしで起動し、監視役が結果を書かずに終わったときは未確認として返す
  const holder = currentHolder();
  const prepared = holder && prepareHolder(holder);
  // 待ったあとも、残り時間がなければ監視役も対象も起動しない（REQ-180・REQ-257）
  const startedAt = monotonicMs();
  const timeout = timeLeft();
  if (timeout <= 0) throw new ProcessLimitError('timeout', command);
  positive(timeout);
  const holdId = holder ? randomBytes(16).toString('hex') : undefined;
  let hold: { pipe: string; id: string; expiresAt: number } | { unavailable: string } | null = null;
  if (prepared && holdId) hold = 'pipe' in prepared ? { pipe: prepared.pipe, id: holdId, expiresAt: holdExpiry(Date.now(), timeout) } : prepared;
  const result = spawnSync(process.execPath, [SUPERVISOR, JSON.stringify([command, args, options.shell ?? false, startedAt + timeout, maxBuffer, hold])], {
    cwd: options.cwd, env: options.env, stdio: ['ignore', 'pipe', 'pipe', 'pipe'], maxBuffer: Math.max(maxBuffer, 64 * 1024),
  });
  // 不正なUTF-8の置換で文字列のバイト数が増えても、公開する文字列の合計は予算以内にする。
  // 起動に失敗すると、型に反して stdout・stderr が null になる
  const output = result as { stdout: Buffer | null; stderr: Buffer | null; output: (Buffer | null)[] | null };
  const stdout = utf8Prefix(output.stdout?.toString('utf8') ?? '', maxBuffer);
  const stderr = utf8Prefix(output.stderr?.toString('utf8') ?? '', maxBuffer - Buffer.byteLength(stdout));
  const report = readReport(output.output?.[3]?.toString('utf8') ?? '');
  const usesHolder = hold !== null && 'pipe' in hold ? holdId : undefined;
  const outcome = report.outcome;
  if (result.error) {
    if (!outcome) stopTree(report.target, holdId, holder);
    else if (usesHolder) holder?.release(usesHolder);
    return { status: null, signal: result.signal, stdout, stderr, error: result.error };
  }
  if (!outcome) {
    // 外からの強制終了（Windows の process.kill(pid, 'SIGINT') など）や異常終了で、監視役が結果を書かなかった。
    // 残った子孫を止め、使い方の誤りではなく理由を含む中断として返し、同じ共有予算の後続の操作を止める（REQ-250）
    // 後片付けの 10 秒は共有予算から引かず、期限も延ばさない。結果によらず、同じ共有予算の後続の操作を止める（REQ-253）
    if (budget) budget.state.interrupted = true;
    const cleanup = stopTree(report.target, holdId, holder);
    const ended = result.signal ? `シグナル ${result.signal}` : `終了コード ${String(result.status)}`;
    throw missingResultError(command, stdout, stderr, ended, report.invalid, cleanup);
  }
  // 有効な通常の結果を読めたので、保持を解放する。監視役が結果を書いたことだけでは解放しない（REQ-255）
  if (usesHolder) holder?.release(usesHolder);
  if (outcome.kind) {
    if (outcome.kind === 'interrupted' && budget) budget.state.interrupted = true;
    throw new ProcessLimitError(outcome.kind, command, stdout, stderr);
  }
  const error = outcome.error && Object.assign(new Error(outcome.error.message), { code: outcome.error.code });
  return { status: outcome.status, signal: outcome.signal, stdout, stderr, ...(error ? { error } : {}) };
}
