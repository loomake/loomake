import { execFileSync } from 'node:child_process';
import { DOCUMENT_LIMITS, type InputLimits } from '../../runtime/input.js';
import { isSafeRepoPath } from './canonical.js';

export type GitDocument = { file: string; text: string; oid: string; mode: '100644' | '100755' };

const GIT_METADATA_BYTES = DOCUMENT_LIMITS.maxTotalBytes;
const DOCUMENT_ROW = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/;

/** checkout の内容を読まず、固定 commit の通常 blob だけを既存の文書予算内で読む。 */
export function readGitDocuments(repository: string, commit: string, prefix: string,
  limits: Readonly<InputLimits> = DOCUMENT_LIMITS): GitDocument[] {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Git の対象には完全な commit SHA を指定してください');
  if (!isSafeRepoPath(prefix)) throw new Error('Git の読取り path が不正です');
  let defaultValues = 0;
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < (key === 'maxDepth' ? 0 : 1)) throw new Error('Git の入力予算が不正です');
    if (Object.hasOwn(DOCUMENT_LIMITS, key) && value === DOCUMENT_LIMITS[key as keyof InputLimits]) defaultValues++;
  }
  const git = (args: string[], maxBuffer: number, input?: string): Buffer => execFileSync('git', ['--no-replace-objects', '--literal-pathspecs', '-C', repository, ...args],
    { maxBuffer, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], ...(input === undefined ? {} : { input }) });
  const decode = (bytes: Buffer): string => {
    try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { throw new Error('Git の文書は正しい UTF-8 で記述してください'); }
  };
  const metadataBytes = (args: string[], input?: string): Buffer => {
    try { return git(args, GIT_METADATA_BYTES, input); }
    catch (error) {
      if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOBUFS') {
        throw new Error('Git のメタデータが読取りの上限を超えています', { cause: error });
      }
      throw error;
    }
  };
  const metadata = (args: string[]): string => decode(metadataBytes(args));
  if (metadata(['cat-file', '-t', commit]).trim() !== 'commit') throw new Error('指定した Git object は commit ではありません');
  const listing = metadata(['ls-tree', '-rz', '--full-tree', commit, '--', prefix]);
  const rows = listing ? listing.slice(0, -1).split('\0') : [];
  if (listing && !listing.endsWith('\0')) throw new Error('Git の tree 一覧が完了していません');
  if (rows.length > limits.maxEntries) throw new Error('Git の探索項目が文書の上限を超えています');
  const matches = rows.map((row) => DOCUMENT_ROW.exec(row));
  const eligible = defaultValues === 4 && rows.length > 1 && matches.every((match) => match && isSafeRepoPath(match[3])
    && (match[3] === prefix || match[3].startsWith(`${prefix}/`)) && match[3].split('/').length - 1 <= DOCUMENT_LIMITS.maxDepth);
  const readSizes = (): number[] | null => {
    const oids = matches.filter((match) => match !== null).map((match) => match[2]);
    let bytes: Buffer;
    try { bytes = metadataBytes(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], oids.join('\n') + '\n'); }
    catch (error) {
      if (error === null || typeof error !== 'object' || !('status' in error) || typeof error.status !== 'number'
        || error.status === 0 || ('signal' in error && error.signal) || ('code' in error && error.code)) throw error;
      return null;
    }
    let text: string;
    try { text = decode(bytes); } catch { return null; }
    if (!text.endsWith('\n')) return null;
    const sizes = text.slice(0, -1).split('\n');
    if (sizes.length !== oids.length) return null;
    const parsed: number[] = [];
    for (const [index, size] of sizes.entries()) {
      const match = /^([a-f0-9]{40}) blob (0|[1-9][0-9]*)$/.exec(size);
      if (!match || match[1] !== oids[index] || !Number.isSafeInteger(Number(match[2]))) return null;
      parsed.push(Number(match[2]));
    }
    return parsed;
  };
  const sizes = eligible ? readSizes() : null;
  const documents: GitDocument[] = [];
  let total = 0;
  for (const [index, row] of rows.entries()) {
    const match = DOCUMENT_ROW.exec(row);
    if (!match) throw new Error('Git の入力には通常ファイルだけを使用してください');
    const [, mode, oid, file] = match;
    if (!isSafeRepoPath(file) || (file !== prefix && !file.startsWith(`${prefix}/`))) throw new Error('Git の tree に不正な path があります');
    if (file.split('/').length - 1 > limits.maxDepth) throw new Error('Git の探索の深さが文書の上限を超えています');
    const size = sizes ? sizes[index] : Number(metadata(['cat-file', '-s', oid]).trim());
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
