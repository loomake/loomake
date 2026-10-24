import { closeSync, constants, fstatSync, lstatSync, openSync, opendirSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { UsageError } from './errors.js';

// Windows には O_NOFOLLOW・O_NONBLOCK がない。型は number だが、実行時は undefined になる
const optionalFlag = (name: 'O_NOFOLLOW' | 'O_NONBLOCK'): number => (constants as Partial<Record<string, number>>)[name] ?? 0;

export type InputLimits = { maxFileBytes: number; maxTotalBytes: number; maxEntries: number; maxDepth: number };
export const DOCUMENT_LIMITS: Readonly<InputLimits> = Object.freeze({
  maxFileBytes: 1024 * 1024,
  maxTotalBytes: 16 * 1024 * 1024,
  maxEntries: 4096,
  maxDepth: 32,
});
export const JSON_LIMITS: Readonly<InputLimits> = Object.freeze({ ...DOCUMENT_LIMITS, maxFileBytes: 64 * 1024 * 1024, maxTotalBytes: 128 * 1024 * 1024 });
export type InputEntry = { name: string; kind: 'file' | 'directory' };
export type InputReader = {
  read: (file: string) => string;
  entries: (dir: string, options?: { skipIgnored?: boolean }) => InputEntry[];
  walk: (dir: string, options?: { skipIgnored?: boolean }) => string[];
};

/** 1つの入力処理で共有し、実際に読んだバイト数と探索の訪問数を制限する。 */
export function createInputReader(overrides: Partial<InputLimits> = {}): InputReader {
  const limits = { ...DOCUMENT_LIMITS, ...overrides };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < (key === 'maxDepth' ? 0 : 1)) throw new UsageError(`入力予算の${key}は${key === 'maxDepth' ? '0以上' : '正'}の安全な整数にしてください`);
  }
  let bytes = 0;
  let visited = 0;
  const fail = (path: string, reason: string): never => { throw new UsageError(`入力を読み取れません：${reason}（${path}）`); };
  const regular = (path: string, stats: NonNullable<ReturnType<typeof lstatSync>>, directory = false) => {
    if (stats.isSymbolicLink()) fail(path, 'シンボリックリンクは扱えません');
    if (directory ? !stats.isDirectory() : !stats.isFile()) fail(path, directory ? '通常のディレクトリではありません' : '通常のファイルではありません');
  };
  const reader: InputReader = {
    read(file) {
      let fd: number | undefined;
      let size = 0;
      const chunks: Buffer[] = [];
      const budget = (length: number) => {
        if (length > limits.maxFileBytes) fail(file, `ファイルの上限は${limits.maxFileBytes}バイトです`);
        if (bytes + length > limits.maxTotalBytes) fail(file, `読み取り合計の上限は${limits.maxTotalBytes}バイトです`);
      };
      try {
        regular(file, lstatSync(file));
        fd = openSync(file, constants.O_RDONLY | optionalFlag('O_NOFOLLOW') | optionalFlag('O_NONBLOCK'));
        const stats = fstatSync(fd);
        regular(file, stats);
        budget(stats.size);
        const available = Math.min(limits.maxFileBytes, limits.maxTotalBytes - bytes);
        const buffer = Buffer.alloc(Math.min(64 * 1024, available + 1));
        for (;;) {
          const length = readSync(fd, buffer, 0, Math.min(buffer.length, available - size + 1), null);
          if (length === 0) break;
          size += length;
          budget(size);
          chunks.push(Buffer.from(buffer.subarray(0, length)));
        }
        bytes += size;
        return Buffer.concat(chunks, size).toString('utf8');
      } catch (error) {
        if (error instanceof UsageError) throw error;
        return fail(file, (error as Error).message);
      } finally { if (fd !== undefined) closeSync(fd); }
    },
    entries(dir, options = {}) {
      try {
        let stats;
        try { stats = lstatSync(dir); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
        regular(dir, stats, true);
        const handle = opendirSync(dir);
        const found: InputEntry[] = [];
        try {
          for (;;) {
            const entry = handle.readSync();
            if (!entry) break;
            if (++visited > limits.maxEntries) fail(dir, `探索項目の上限は${limits.maxEntries}です`);
            if (options.skipIgnored && (entry.name === 'node_modules' || entry.name.startsWith('.'))) continue;
            const path = join(dir, entry.name);
            const stats = lstatSync(path);
            if (stats.isSymbolicLink()) fail(path, 'シンボリックリンクは扱えません');
            if (!stats.isFile() && !stats.isDirectory()) fail(path, '通常のファイルかディレクトリではありません');
            found.push({ name: entry.name, kind: stats.isDirectory() ? 'directory' : 'file' });
          }
        } finally { handle.closeSync(); }
        return found.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
      } catch (error) {
        if (error instanceof UsageError) throw error;
        return fail(dir, (error as Error).message);
      }
    },
    walk(dir, options = {}) {
      const files: string[] = [];
      const visit = (current: string, depth: number) => {
        if (depth > limits.maxDepth) fail(current, `探索の深さの上限は${limits.maxDepth}です`);
        for (const entry of reader.entries(current, options)) {
          if (options.skipIgnored && (entry.name === 'node_modules' || entry.name.startsWith('.'))) continue;
          const path = join(current, entry.name);
          if (entry.kind === 'directory') visit(path, depth + 1);
          else files.push(path);
        }
      };
      visit(dir, 0);
      return files;
    },
  };
  return reader;
}
