import { UsageError } from './errors.js';
// changeの探索を共有し、文書を読む処理と同じ予算を使う。
import { existsSync, lstatSync } from 'node:fs';
import { join, sep } from 'node:path';
import { createInputReader, type InputReader } from './input.js';

export const toPosix = (p: string) => p.split(sep).join('/');

export type ChangeLocation = { kind: 'active' | 'archived'; dir: string } | { kind: 'missing' | 'ambiguous'; dirs: string[] };

export function resolveChangeDir(changesDir: string, id: string, reader: InputReader = createInputReader()): ChangeLocation {
  const active = join(changesDir, id);
  const present = (path: string): boolean => {
    try { lstatSync(path); return true; } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return false;
      throw new UsageError(`change の置き場「${path}」を調べられません（${(error as Error).message}）`, { cause: error });
    }
  };
  if (present(active)) return { kind: 'active', dir: active };
  const archive = join(changesDir, 'archive');
  if (!present(archive)) return { kind: 'missing', dirs: [] };
  const dirs = reader.entries(archive).filter((entry) => entry.kind === 'directory' &&
    /^\d{4}-\d{2}-\d{2}-/.test(entry.name) && entry.name.slice(11) === id).map((entry) => join(archive, entry.name));
  return dirs.length === 1 ? { kind: 'archived', dir: dirs[0] } : { kind: dirs.length ? 'ambiguous' : 'missing', dirs };
}

export function specFiles(changeDir: string, reader: InputReader = createInputReader()): string[] {
  return reader.walk(join(changeDir, 'specs'), { skipIgnored: true }).filter((f) => f.endsWith('spec.md')).sort();
}

export function findChangeDir(changesDir: string, changeId: string, file = 'trace.md', reader: InputReader = createInputReader()): string | undefined {
  const active = join(changesDir, changeId);
  if (changeId !== 'archive' && existsSync(join(active, file))) return active;
  const archiveDir = join(changesDir, 'archive');
  if (!existsSync(archiveDir)) return undefined;
  return reader.entries(archiveDir).filter((e) => e.kind === 'directory')
    .map((e) => e.name).filter((d) => d.replace(/^\d{4}-\d{2}-\d{2}-/, '') === changeId).sort().reverse()
    .map((d) => join(archiveDir, d)).find((d) => existsSync(join(d, file)));
}
