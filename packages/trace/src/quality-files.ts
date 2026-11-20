import { randomUUID } from 'node:crypto';
import { closeSync, constants, existsSync, fstatSync, fsyncSync, ftruncateSync, lstatSync, mkdirSync, openSync, readSync, renameSync, unlinkSync, writeSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { JSON_LIMITS, RuntimeFailure, UsageError } from '@loomake/kit';
import { QUALITY_UUID, positiveInteger, qualityEvaluationProblem, qualityIsoDate, type QualityEvaluation } from './quality-model.js';
import { runPairKey, validateQualityLedgers, type QualityLedgers } from './quality-ledger.js';

export const QUALITY_FILES = {
  requests: 'reports/quality/requests.jsonl', attempts: 'reports/quality/attempts.jsonl',
  history: 'reports/quality/history.jsonl', index: 'reports/quality/quality-report.json',
} as const;
export const EVAL_LOCK = '.loomake/quality/eval.lock';
export type QualitySnapshot = Record<keyof typeof QUALITY_FILES, Buffer | null>;
export type EvalLockToken = { runId: string; requestId: string; pid: number; createdAt: string };
export type OwnedEvalLock = { root: string; token: EvalLockToken };
export type QualityStorage = { snapshot: QualitySnapshot; ledgers: QualityLedgers; index: QualityEvaluation | null; repairIndex: boolean };
const flag = (name: 'O_NOFOLLOW' | 'O_NONBLOCK') => (constants as Partial<Record<string, number>>)[name] ?? 0;
const code = (error: unknown) => (error as NodeJS.ErrnoException).code;
const failure = (action: string): UsageError => new UsageError(`評価の帳簿を${action}できません。保存先と権限を確認してください`);

/** 既知の保存先の途中も検査し、リンク先や特殊ファイルへ入らない。 */
export function ensureQualityPaths(root: string, create = false): void {
  try {
    const base = resolve(root);
    if (!lstatSync(base).isDirectory() || lstatSync(base).isSymbolicLink()) throw failure('準備');
    for (const relative of ['.loomake', '.loomake/quality', 'reports', 'reports/quality']) {
      const directory = join(base, relative);
      let stat;
      try { stat = lstatSync(directory); }
      catch (error) {
        if (code(error) !== 'ENOENT') throw error;
        if (!create) continue;
        mkdirSync(directory); stat = lstatSync(directory);
      }
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw failure('準備');
    }
    for (const relative of [...Object.values(QUALITY_FILES), EVAL_LOCK]) {
      let stat;
      try { stat = lstatSync(join(base, relative)); } catch (error) { if (code(error) === 'ENOENT') continue; throw error; }
      if (!stat.isFile() || stat.isSymbolicLink()) throw failure('準備');
    }
  } catch (error) { if (error instanceof UsageError) throw error; throw failure('準備'); }
}

/** 原文のバイト列を読む。各file64MiB・収集全体128MiBを読取り中も越えない。 */
function readBytes(file: string, budget: { bytes: number }, max = JSON_LIMITS.maxFileBytes): Buffer | null {
  let fd: number | undefined; let result: Buffer | null = null; let problem: Error | undefined;
  try {
    let stat;
    try { stat = lstatSync(file); } catch (error) { if (code(error) === 'ENOENT') return null; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink()) throw failure('読取');
    fd = openSync(file, constants.O_RDONLY | flag('O_NOFOLLOW') | flag('O_NONBLOCK'));
    stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > max || budget.bytes + stat.size > JSON_LIMITS.maxTotalBytes) throw failure('読取');
    const available = Math.min(max, JSON_LIMITS.maxTotalBytes - budget.bytes);
    const chunk = Buffer.alloc(Math.min(64 * 1024, available + 1)); const chunks: Buffer[] = []; let size = 0;
    for (;;) {
      const length = readSync(fd, chunk, 0, Math.min(chunk.length, available - size + 1), null);
      if (!length) break;
      size += length;
      if (size > available) throw failure('読取');
      chunks.push(Buffer.from(chunk.subarray(0, length)));
    }
    budget.bytes += size;
    result = Buffer.concat(chunks, size);
  } catch (error) { problem = error instanceof UsageError ? error : failure('読取'); }
  finally { if (fd !== undefined) { try { closeSync(fd); } catch { problem ??= failure('読取'); } } }
  if (problem) throw problem;
  return result;
}

export function readQualitySnapshot(root: string): QualitySnapshot {
  ensureQualityPaths(root); const budget = { bytes: 0 };
  return Object.fromEntries(Object.entries(QUALITY_FILES).map(([key, relative]) => [key, readBytes(join(root, relative), budget)])) as QualitySnapshot;
}

function decode(bytes: Buffer | null): string {
  if (!bytes) return '';
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new UsageError('評価の帳簿が正しいUTF-8ではありません。原本を確認してください'); }
}

export function parseQualityStorage(snapshot: QualitySnapshot): QualityStorage {
  const ledgers = validateQualityLedgers({ requests: decode(snapshot.requests), attempts: decode(snapshot.attempts), history: decode(snapshot.history) });
  let index: QualityEvaluation | null = null;
  if (snapshot.index !== null) {
    let value: unknown;
    try { value = JSON.parse(decode(snapshot.index)); } catch { throw new UsageError('評価の最新索引を読めません。原本を確認してください'); }
    const issue = qualityEvaluationProblem(value); if (issue) throw new UsageError(issue);
    const parsed = value as QualityEvaluation; index = parsed;
    const matching = ledgers.history.find((row) => runPairKey(row) === runPairKey(parsed));
    if (!matching || !isDeepStrictEqual(matching, index)) throw new UsageError('評価の最新索引の出どころを履歴で確認できません。原本を保持して確認してください');
  }
  const last = ledgers.history.at(-1);
  return { snapshot, ledgers, index, repairIndex: last !== undefined && !isDeepStrictEqual(last, index) };
}

export function readQualityStorage(root: string): QualityStorage { return parseQualityStorage(readQualitySnapshot(root)); }

export function acquireEvalLock(root: string, token: EvalLockToken): OwnedEvalLock | undefined {
  if (!QUALITY_UUID.test(token.runId) || !QUALITY_UUID.test(token.requestId) || !positiveInteger(token.pid) || !qualityIsoDate(token.createdAt)) throw failure('ロック');
  ensureQualityPaths(root, true); let fd: number | undefined; let created = false;
  try {
    fd = openSync(join(root, EVAL_LOCK), 'wx', 0o600); created = true;
    writeAll(fd, Buffer.from(JSON.stringify(token)));
    fsyncSync(fd); const closing = fd; fd = undefined; closeSync(closing);
    return { root, token: { ...token } };
  } catch (error) {
    if (!created && code(error) === 'EEXIST') return undefined;
    if (fd !== undefined) { try { closeSync(fd); } catch { /* 失敗状態を保つ。 */ } }
    if (created) { try { if (ownsEvalLock({ root, token })) unlinkSync(join(root, EVAL_LOCK)); } catch { /* 所有を確かめられないロックは残す。 */ } }
    throw new UsageError('評価ロックを作成できません。残っているロックは内容を確認してから手動で片付けてください');
  }
}

export function ownsEvalLock(lock: OwnedEvalLock): boolean {
  ensureQualityPaths(lock.root);
  const bytes = readBytes(join(lock.root, EVAL_LOCK), { bytes: 0 }, 4096);
  if (!bytes) return false;
  try { return isDeepStrictEqual(JSON.parse(bytes.toString('utf8')), lock.token); } catch { return false; }
}

export function assertEvalOwner(lock: OwnedEvalLock): void {
  if (!ownsEvalLock(lock)) throw new RuntimeFailure('評価の実行権が変わりました。帳簿へ書かず、残った要求を次の実行者へ残します');
}

export function releaseOwnEvalLock(lock: OwnedEvalLock): boolean {
  if (!ownsEvalLock(lock)) return false;
  try { unlinkSync(join(lock.root, EVAL_LOCK)); return true; }
  catch (error) { if (code(error) === 'ENOENT') return false; throw failure('片付け'); }
}

function writeAll(fd: number, bytes: Buffer): void {
  let written = 0;
  while (written < bytes.length) { const length = writeSync(fd, bytes, written, bytes.length - written); if (!length) throw failure('追記'); written += length; }
}

/** 既存の行は保持し、失敗時には一致を確認できた自分の末尾だけを戻す。 */
export function appendQualityRows(lock: OwnedEvalLock, key: 'requests' | 'attempts' | 'history', rows: readonly unknown[]): void {
  assertEvalOwner(lock); ensureQualityPaths(lock.root);
  const file = join(lock.root, QUALITY_FILES[key]); const budget = { bytes: 0 }; const before = readBytes(file, budget) ?? Buffer.alloc(0);
  const addition = Buffer.from(rows.map((row) => `${JSON.stringify(row)}\n`).join(''));
  if (!rows.length || addition.length + before.length > JSON_LIMITS.maxFileBytes) throw failure('追記');
  let fd: number | undefined; let problem: Error | undefined;
  try {
    fd = openSync(file, constants.O_RDWR | constants.O_CREAT | constants.O_APPEND | flag('O_NOFOLLOW') | flag('O_NONBLOCK'), 0o600);
    if (!fstatSync(fd).isFile() || fstatSync(fd).size !== before.length) throw failure('追記');
    writeAll(fd, addition); fsyncSync(fd);
  } catch (error) {
    let restored = false;
    if (fd !== undefined) {
      try {
        const current = readBytes(file, budget);
        const tail = current?.subarray(before.length);
        if (current && current.length <= before.length + addition.length && current.subarray(0, before.length).equals(before)
          && tail?.equals(addition.subarray(0, tail.length)) && ownsEvalLock(lock)) {
          ftruncateSync(fd, before.length); fsyncSync(fd); restored = true;
        }
      } catch { /* 不完全な末尾の可能性は診断へ残す。 */ }
    }
    if (!restored && fd !== undefined) problem = new UsageError('評価の追記を戻せません。不完全な末尾の可能性があるため、原本を保持して手動で復旧してください');
    else problem = error instanceof RuntimeFailure ? error : failure('追記');
  } finally { if (fd !== undefined) { try { closeSync(fd); } catch { problem ??= failure('片付け'); } } }
  if (problem) throw problem;
}

/** historyの確定後に呼ぶ。最終名は完全な一時ファイルからだけ置き換える。 */
export function replaceQualityIndex(lock: OwnedEvalLock, report: QualityEvaluation): void {
  assertEvalOwner(lock); ensureQualityPaths(lock.root, true);
  const issue = qualityEvaluationProblem(report); if (issue) throw new UsageError(issue);
  const content = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  if (content.length > JSON_LIMITS.maxFileBytes) throw failure('保存');
  const file = join(lock.root, QUALITY_FILES.index); const temporary = join(dirname(file), `.quality-report-${randomUUID()}.tmp`);
  let fd: number | undefined; let created = false; let problem: Error | undefined;
  try {
    fd = openSync(temporary, 'wx', 0o600); created = true; writeAll(fd, content); fsyncSync(fd);
    const closing = fd; fd = undefined; closeSync(closing);
    assertEvalOwner(lock); ensureQualityPaths(lock.root); renameSync(temporary, file); created = false;
  } catch (error) { problem = error instanceof RuntimeFailure ? error : failure('保存'); }
  finally {
    if (fd !== undefined) { try { closeSync(fd); } catch { problem ??= failure('片付け'); } }
    if (created && existsSync(temporary)) { try { unlinkSync(temporary); } catch { problem ??= failure('一時ファイルの片付け'); } }
  }
  if (problem) throw problem;
}

/** 実行前後は存在の有無と全バイトを比べ、JSONの再整形で違いを隠さない。 */
export function sameQualitySnapshot(left: QualitySnapshot, right: QualitySnapshot): boolean {
  return (Object.keys(QUALITY_FILES) as (keyof QualitySnapshot)[]).every((key) => {
    const a = left[key], b = right[key];
    return a === null ? b === null : b !== null && a.equals(b);
  });
}
