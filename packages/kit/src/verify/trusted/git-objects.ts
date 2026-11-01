import { execFileSync } from 'node:child_process';
import { DOCUMENT_LIMITS, type InputLimits } from '../../runtime/input.js';
import { isSafeRepoPath } from './canonical.js';

export type GitDocument = { file: string; text: string; oid: string; mode: '100644' | '100755' };

const GIT_METADATA_BYTES = DOCUMENT_LIMITS.maxTotalBytes;

/** checkout の内容を読まず、固定 commit の通常 blob だけを既存の文書予算内で読む。 */
export function readGitDocuments(repository: string, commit: string, prefix: string,
  limits: Readonly<InputLimits> = DOCUMENT_LIMITS): GitDocument[] {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Git の対象には完全な commit SHA を指定してください');
  if (!isSafeRepoPath(prefix)) throw new Error('Git の読取り path が不正です');
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < (key === 'maxDepth' ? 0 : 1)) throw new Error('Git の入力予算が不正です');
  }
  const git = (args: string[], maxBuffer: number): Buffer => execFileSync('git', ['--no-replace-objects', '--literal-pathspecs', '-C', repository, ...args],
    { maxBuffer, stdio: ['ignore', 'pipe', 'pipe'] });
  const decode = (bytes: Buffer): string => {
    try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { throw new Error('Git の文書は正しい UTF-8 で記述してください'); }
  };
  const metadata = (args: string[]): string => {
    try { return decode(git(args, GIT_METADATA_BYTES)); }
    catch (error) {
      if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOBUFS') {
        throw new Error('Git のメタデータが読取りの上限を超えています');
      }
      throw error;
    }
  };
  if (metadata(['cat-file', '-t', commit]).trim() !== 'commit') throw new Error('指定した Git object は commit ではありません');
  const listing = metadata(['ls-tree', '-rz', '--full-tree', commit, '--', prefix]);
  const rows = listing ? listing.slice(0, -1).split('\0') : [];
  if (listing && !listing.endsWith('\0')) throw new Error('Git の tree 一覧が完了していません');
  if (rows.length > limits.maxEntries) throw new Error('Git の探索項目が文書の上限を超えています');
  const documents: GitDocument[] = [];
  let total = 0;
  for (const row of rows) {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(row);
    if (!match) throw new Error('Git の入力には通常ファイルだけを使用してください');
    const [, mode, oid, file] = match;
    if (!isSafeRepoPath(file) || (file !== prefix && !file.startsWith(`${prefix}/`))) throw new Error('Git の tree に不正な path があります');
    if (file.split('/').length - 1 > limits.maxDepth) throw new Error('Git の探索の深さが文書の上限を超えています');
    const size = Number(metadata(['cat-file', '-s', oid]).trim());
    if (!Number.isSafeInteger(size) || size < 0 || size > limits.maxFileBytes || total + size > limits.maxTotalBytes) {
      throw new Error('Git の入力が文書のバイト上限を超えています');
    }
    const bytes = git(['cat-file', 'blob', oid], Math.max(1, limits.maxFileBytes));
    if (bytes.length !== size) throw new Error('Git の blob の大きさが一致しません');
    total += size;
    documents.push({ file, text: decode(bytes), oid, mode: mode as GitDocument['mode'] });
  }
  return documents;
}
