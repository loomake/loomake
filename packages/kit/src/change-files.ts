// change のファイルの探し方。verify・trace・run が同じ探し方をするよう、ここにまとめる
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

/** OS のパスの区切りを / にする */
export const toPosix = (p: string) => p.split(sep).join('/');

// node_modules と、ドットで始まる名前は見ない
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** change の差分仕様（specs/ の下の spec.md）のパス。名前の順に並べる */
export const specFiles = (changeDir: string): string[] => walk(join(changeDir, 'specs')).filter((f) => f.endsWith('spec.md'));

/**
 * change のディレクトリを、進行中の change から探し、なければ archive の <日付>-<change-id> のうち新しいものから探す。
 * file を持つディレクトリだけを返す。見つからなければ undefined
 */
export function findChangeDir(changesDir: string, changeId: string, file = 'trace.md'): string | undefined {
  const active = join(changesDir, changeId);
  if (changeId !== 'archive' && existsSync(join(active, file))) return active;
  const archiveDir = join(changesDir, 'archive');
  if (!existsSync(archiveDir)) return undefined;
  return readdirSync(archiveDir)
    .filter((d) => d.replace(/^\d{4}-\d{2}-\d{2}-/, '') === changeId)
    .sort()
    .reverse()
    .map((d) => join(archiveDir, d))
    .find((d) => existsSync(join(d, file)));
}
