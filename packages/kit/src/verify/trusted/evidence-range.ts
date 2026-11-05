import { ProcessLimitError, runExternalBytes } from '../../runtime/process.js';
import { JSON_LIMITS, type InputLimits } from '../../runtime/input.js';
import { UsageError } from '../../runtime/errors.js';
import { CHANGE_ID } from '../config.js';
import { isSafeRepoPath } from './canonical.js';

export type EvidenceRangeEntry = { readonly commit: string; readonly path: string; readonly oid: string; readonly kind: 'evidence' | 'reuse' };
export type EvidenceRangeReasonCode = 'SHALLOW_REPOSITORY' | 'SOURCE_UNAVAILABLE' | 'EMPTY_RANGE' | 'SOURCE_NOT_ANCESTOR'
  | 'RANGE_TOO_LARGE' | 'MERGE_IN_RANGE' | 'ENTRY_NOT_ADDED' | 'ENTRY_MODE' | 'ENTRY_PATH_NOT_ALLOWED' | 'GIT_RANGE_UNREADABLE';
export type EvidenceRangeReason = { readonly code: EvidenceRangeReasonCode; readonly message: string; readonly commit?: string; readonly path?: string };
export type EvidenceRangeOptions = { repository: string; source: string; target: string; changeId: string };
export type EvidenceRange =
  | { readonly allowed: true; readonly source: string; readonly target: string; readonly commits: readonly string[];
      readonly entries: readonly EvidenceRangeEntry[] }
  | { readonly allowed: false; readonly source: string; readonly target: string; readonly reasons: readonly EvidenceRangeReason[] };
export type GitTreeLookup = { readonly kind: 'found'; readonly mode: string; readonly type: string; readonly oid: string } | { readonly kind: 'absent' } | { readonly kind: 'unreadable' };
export type GitBlobText = { readonly ok: true; readonly text: string; readonly bytes: number } | { readonly ok: false; readonly code: 'BLOB_UNREADABLE' | 'BLOB_TOO_LARGE' | 'BLOB_NOT_UTF8' };
export type GitEvidenceReader = { treeEntry(commit: string, path: string): GitTreeLookup; readText(oid: string): GitBlobText };
const SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const META = 16 * 1024 * 1024;
const decode = (bytes: Uint8Array) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
function git(repository: string, args: string[], maxBuffer = META) {
  const r = runExternalBytes('git', ['--no-replace-objects', '--literal-pathspecs', '-C', repository, ...args], { maxBuffer });
  if (r.error) throw new UsageError('git を起動できません。Git を利用できるリポジトリで実行してください');
  return r;
}
function kind(path: string, change: string): 'evidence' | 'reuse' | undefined {
  if (!isSafeRepoPath(path)) return undefined;
  const prefix = `.loomake/evidence/${change}/`;
  if (!path.startsWith(prefix)) return undefined;
  const name = path.slice(prefix.length);
  if (/^\d{8}T\d{6}Z-[a-f0-9]{12}\.json$/.test(name)) return 'evidence';
  if (/^reuse\/\d{8}T\d{6}Z-[a-f0-9]{12}\.json$/.test(name)) return 'reuse';
  return undefined;
}
/** メタデータだけを分類する。本文の意味検証は trace が担う。 */
export function classifyEvidenceRange(commit: string, raw: string, change: string): { entries: EvidenceRangeEntry[]; reasons: EvidenceRangeReason[] } {
  const entries: EvidenceRangeEntry[] = [];
  const reasons: EvidenceRangeReason[] = [];
  const rows = raw.split('\0');
  if (rows.pop() !== '' || rows.length % 2 !== 0) return { entries, reasons: [{ code: 'GIT_RANGE_UNREADABLE', message: 'Git の差分が完了していません', commit }] };
  for (let i = 0; i < rows.length; i += 2) {
    const match = /^:(\d{6}) (\d{6}) ([a-f0-9]{40}|[a-f0-9]{64}) ([a-f0-9]{40}|[a-f0-9]{64}) ([A-Z][0-9]*)$/.exec(rows[i]);
    const path = rows[i + 1];
    if (!match) { reasons.push({ code: 'GIT_RANGE_UNREADABLE', message: 'Git の差分の形式が不正です', commit }); break; }
    const problem = (code: EvidenceRangeReasonCode, message: string) => reasons.push({ code, message, commit, path });
    if (match[5] !== 'A') problem('ENTRY_NOT_ADDED', '追加以外の変更があります');
    if (match[1] !== '000000' || match[2] !== '100644') problem('ENTRY_MODE', '通常ファイルの追加ではありません');
    const entryKind = kind(path, change);
    if (!entryKind) problem('ENTRY_PATH_NOT_ALLOWED', '許可された証跡のパスではありません');
    entries.push({ commit, path, oid: match[4], kind: entryKind ?? 'evidence' });
  }
  return { entries, reasons };
}

/** Git の原本から、範囲の各コミットの全差分を読む。データ由来の拒否は理由として返す。 */
export function readEvidenceRange(options: EvidenceRangeOptions): EvidenceRange {
  const { repository, source, target, changeId } = options;
  if (typeof source !== 'string' || typeof target !== 'string' || typeof changeId !== 'string'
    || !SHA.test(source) || !SHA.test(target) || !CHANGE_ID.test(changeId) || changeId === 'archive') throw new UsageError('Git の範囲には完全な小文字の SHA と正しい change-id を指定してください');
  const denied = (code: EvidenceRangeReasonCode, message: string): EvidenceRange => ({ allowed: false, source, target, reasons: [{ code, message }] });
  try {
    let r = git(repository, ['rev-parse', '--is-shallow-repository']);
    if (r.status !== 0) return denied('GIT_RANGE_UNREADABLE', 'Git の範囲を読めません');
    if (decode(r.stdout).trim() === 'true') return denied('SHALLOW_REPOSITORY', 'shallow のリポジトリは扱えません');
    if (source.length !== target.length) return denied('SOURCE_UNAVAILABLE', 'source の形式がリポジトリと違います');
    for (const [sha, code] of [[source, 'SOURCE_UNAVAILABLE'], [target, 'GIT_RANGE_UNREADABLE']] as const) {
      r = git(repository, ['cat-file', '-t', sha]);
      if (r.status !== 0 || decode(r.stdout).trim() !== 'commit') return denied(code, '対象の commit を読めません');
    }
    if (source === target) return denied('EMPTY_RANGE', 'source と target が同じです');
    r = git(repository, ['merge-base', '--is-ancestor', source, target]);
    if (r.status !== 0) return denied(r.status === 1 ? 'SOURCE_NOT_ANCESTOR' : 'GIT_RANGE_UNREADABLE', 'source が target の祖先であると確認できません');
    r = git(repository, ['rev-list', '--reverse', '--parents', '--max-count=4097', `${source}..${target}`]);
    if (r.status !== 0) return denied('GIT_RANGE_UNREADABLE', 'コミットの一覧を読めません');
    const text = decode(r.stdout);
    if (!text.endsWith('\n')) return denied('GIT_RANGE_UNREADABLE', 'コミットの一覧が完了していません');
    const rows = text.trimEnd().split('\n').map((line) => line.split(' '));
    if (rows.length > 4096) return denied('RANGE_TOO_LARGE', 'コミットの上限4096件を超えています');
    if (rows.some((row) => row.some((sha) => !SHA.test(sha) || sha.length !== target.length))) return denied('GIT_RANGE_UNREADABLE', 'コミットの一覧の形式が不正です');
    const merges = rows.filter((row) => row.length !== 2).map((row): EvidenceRangeReason => ({ code: 'MERGE_IN_RANGE', message: '親が1つでないコミットがあります', commit: row[0] }));
    if (merges.length) return { allowed: false, source, target, reasons: merges };
    const entries: EvidenceRangeEntry[] = [];
    const reasons: EvidenceRangeReason[] = [];
    for (const [commit, parent] of rows) {
      r = git(repository, ['diff-tree', '-r', '-z', '--raw', '--no-renames', '--no-commit-id', '--full-index', parent, commit]);
      if (r.status !== 0) return denied('GIT_RANGE_UNREADABLE', 'コミットの差分を読めません');
      const classified = classifyEvidenceRange(commit, decode(r.stdout), changeId);
      entries.push(...classified.entries); reasons.push(...classified.reasons);
      if (entries.length > 4096) return denied('RANGE_TOO_LARGE', 'entry の合計上限4096件を超えています');
    }
    return reasons.length ? { allowed: false, source, target, reasons } : { allowed: true, source, target, commits: rows.map((row) => row[0]), entries };
  } catch (error) {
    if (error instanceof ProcessLimitError) {
      if (error.kind === 'output') return denied('RANGE_TOO_LARGE', 'Git のメタデータが上限を超えています');
      throw error;
    }
    if (error instanceof UsageError) throw error;
    return denied('GIT_RANGE_UNREADABLE', 'Git の範囲を読めません');
  }
}

/** 1つのreaderの全呼出しでblobの予算を共有する。重複oidのキャッシュは呼出側が担う。 */
export function createGitEvidenceReader(repository: string, limits: Readonly<InputLimits> = JSON_LIMITS): GitEvidenceReader {
  for (const [key, value] of Object.entries(limits)) if (!Number.isSafeInteger(value) || value < (key === 'maxDepth' ? 0 : 1)) throw new UsageError('Git の入力予算が不正です');
  let total = 0;
  return {
    treeEntry(commit, path) {
      if (!SHA.test(commit) || !isSafeRepoPath(path)) throw new UsageError('Git の読取りには完全な SHA と安全なパスを指定してください');
      try {
        const r = git(repository, ['ls-tree', '-z', '--full-tree', commit, '--', path]);
        if (r.status !== 0) return { kind: 'unreadable' };
        if (!r.stdout.length) return { kind: 'absent' };
        const text = decode(r.stdout);
        const m = /^(\d{6}) (blob|tree|commit) ([a-f0-9]{40}|[a-f0-9]{64})\t([^\0]+)\0$/.exec(text);
        if (!m || m[4] !== path) return { kind: 'unreadable' };
        return { kind: 'found', mode: m[1], type: m[2], oid: m[3] };
      } catch (error) {
        if (error instanceof ProcessLimitError && error.kind !== 'output' || error instanceof UsageError) throw error;
        return { kind: 'unreadable' };
      }
    },
    readText(oid) {
      if (!SHA.test(oid)) throw new UsageError('blob の読取りには完全な小文字の oid を指定してください');
      try {
        const sizeResult = git(repository, ['cat-file', '-s', oid]);
        if (sizeResult.status !== 0) return { ok: false, code: 'BLOB_UNREADABLE' };
        const sizeText = decode(sizeResult.stdout).trim();
        const size = Number(sizeText);
        if (!/^(0|[1-9]\d*)$/.test(sizeText) || !Number.isSafeInteger(size)) return { ok: false, code: 'BLOB_UNREADABLE' };
        if (size > limits.maxFileBytes || total + size > limits.maxTotalBytes) return { ok: false, code: 'BLOB_TOO_LARGE' };
        const r = git(repository, ['cat-file', 'blob', oid], Math.max(1, size));
        if (r.status !== 0 || r.stdout.length !== size) return { ok: false, code: 'BLOB_UNREADABLE' };
        total += size;
        try { return { ok: true, text: decode(r.stdout), bytes: size }; }
        catch { return { ok: false, code: 'BLOB_NOT_UTF8' }; }
      } catch (error) {
        if (error instanceof ProcessLimitError) {
          if (error.kind === 'output') return { ok: false, code: 'BLOB_TOO_LARGE' };
          throw error;
        }
        if (error instanceof UsageError) throw error;
        return { ok: false, code: 'BLOB_UNREADABLE' };
      }
    },
  };
}
