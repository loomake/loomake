import { createHash } from 'node:crypto';
import { runExternal, UsageError } from '@loomake/kit';
import { assertEvalOwner, EVAL_LOCK, parseQualityStorage, QUALITY_FILES, type OwnedEvalLock, type QualitySnapshot } from './quality-files.js';

export function qualityGit(root: string, args: string[]): string {
  const result = runExternal('git', args, { cwd: root });
  if (result.error || result.status !== 0) throw new UsageError('評価のGit状態を確認できません。リポジトリと権限を確認してください');
  return result.stdout;
}

/** Gitのblob IDを原文prefixから計算し、文字列decodeでHEADの不一致を隠さない。 */
export function qualityHeadPrefixes(root: string): Map<string, { oid: string; size: number; mode: string }> {
  const listing = qualityGit(root, ['ls-tree', '-zl', '--full-tree', 'HEAD', '--', ...Object.values(QUALITY_FILES)]);
  const output = new Map<string, { oid: string; size: number; mode: string }>();
  for (const entry of listing.split('\0').filter(Boolean)) {
    const match = /^(\d{6}) blob ([0-9a-f]{40}|[0-9a-f]{64})\s+(\d+)\t(.+)$/.exec(entry);
    if (!match || !Number.isSafeInteger(Number(match[3]))) throw new UsageError('HEAD版の帳簿の形を確認できません');
    output.set(match[4], { mode: match[1], oid: match[2], size: Number(match[3]) });
  }
  return output;
}

/** CRLFで取り出した帳簿もHEAD版の先頭一致として比べる（A70-03）。改行以外の違いは一致しない。 */
function hasHeadPrefix(bytes: Buffer | null, head: { oid: string; size: number } | undefined): boolean {
  if (!head) return true;
  return !!bytes && (blobPrefixMatches(bytes, head) || blobPrefixMatches(lfOnly(bytes), head));
}

function lfOnly(bytes: Buffer): Buffer {
  return Buffer.from(bytes.toString('latin1').replaceAll('\r\n', '\n'), 'latin1');
}

function blobPrefixMatches(bytes: Buffer, head: { oid: string; size: number }): boolean {
  if (bytes.length < head.size) return false;
  const hash = createHash(head.oid.length === 40 ? 'sha1' : 'sha256');
  hash.update(`blob ${head.size}\0`); hash.update(bytes.subarray(0, head.size));
  return hash.digest('hex') === head.oid;
}

/** 固定した未ステージ帳簿追記と自分のlockだけを除き、他の変更を許可しない。 */
export function qualityWorktreeClean(lock: OwnedEvalLock, snapshot: QualitySnapshot): boolean {
  assertEvalOwner(lock);
  return !parseQualityStorage(snapshot).repairIndex && qualityChangesAllowed(lock, snapshot);
}

/** 索引の復旧要否を除いた作業ツリー検査。 */
export function qualityChangesAllowed(lock: OwnedEvalLock, snapshot: QualitySnapshot): boolean {
  assertEvalOwner(lock);
  const status = qualityGit(lock.root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const heads = qualityHeadPrefixes(lock.root);
  // ignoreされていてもowner/path検査は上で行う。ignore必須にはしない。
  const ignore = runExternal('git', ['check-ignore', '--quiet', '--', EVAL_LOCK], { cwd: lock.root });
  if (ignore.error || (ignore.status !== 0 && ignore.status !== 1)) throw new UsageError('評価ロックのGit除外状態を確認できません');
  for (const entry of status.split('\0').filter(Boolean)) {
    const xy = entry.slice(0, 2), file = entry.slice(3);
    if (xy !== '??' && xy !== ' M') return false;
    if (file === EVAL_LOCK) { if (xy !== '??') return false; continue; }
    const key = (Object.keys(QUALITY_FILES) as (keyof QualitySnapshot)[]).find((candidate) => QUALITY_FILES[candidate] === file);
    if (!key) return false;
    if (key !== 'index' && !hasHeadPrefix(snapshot[key], heads.get(file))) return false;
  }
  // Gitが検出したモード変更も追記扱いにはしない。
  const raw = qualityGit(lock.root, ['diff', '--raw', '--no-abbrev', '-z', 'HEAD', '--', ...Object.values(QUALITY_FILES)]).split('\0');
  for (let i = 0; i < raw.length; i += 2) {
    const header = raw[i]; if (!header) continue;
    const match = /^:(\d{6}) (\d{6}) /.exec(header);
    if (!match || match[1] !== match[2]) return false;
  }
  return true;
}
