// changeの探索を共有し、文書を読む処理と同じ予算を使う。
import { existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import { createInputReader, type InputReader } from './input.js';

export const toPosix = (p: string) => p.split(sep).join('/');

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
