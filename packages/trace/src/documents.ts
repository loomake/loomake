import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createInputReader } from '@loomake/kit';

/** 証拠に保存する文書の 1 つ。path は change のディレクトリからの / 区切りのパス */
export type EvidenceDocument = { path: string; sha256: string; content: string };

const toPosix = (p: string) => p.split(sep).join('/');

/** change の trace.md と差分仕様を読む。レポートが読むのはこの 2 種類だけ（REQ-127、bind-evidence-to-spec-snapshot の仮定 A-01） */
export function readDocuments(changeDir: string): EvidenceDocument[] {
  const reader = createInputReader();
  const files = [join(changeDir, 'trace.md'), ...reader.walk(join(changeDir, 'specs')).filter((p) => p.endsWith('spec.md'))].filter((p) => existsSync(p));
  return files.map((f) => {
    const content = reader.read(f);
    return { path: toPosix(relative(changeDir, f)), sha256: createHash('sha256').update(content).digest('hex'), content };
  });
}

/** 2 つの文書の組で、内容が違うか、片方にしかない文書のパス */
export function changedDocuments(a: EvidenceDocument[], b: EvidenceDocument[]): string[] {
  const hashes = new Map(b.map((d) => [d.path, d.sha256]));
  const paths = new Set([...a.map((d) => d.path), ...b.map((d) => d.path)]);
  return [...paths].filter((p) => a.find((d) => d.path === p)?.sha256 !== hashes.get(p)).sort();
}
