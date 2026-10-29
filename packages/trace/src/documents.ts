import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createInputReader, specFiles, toPosix } from '@loomake/kit';

import type { EvidenceDocument } from '@loomake/core';
export type { EvidenceDocument } from '@loomake/core';

/** change の trace.md と差分仕様を読む。レポートが読むのはこの 2 種類だけ（REQ-127） */
export function readDocuments(changeDir: string): EvidenceDocument[] {
  const reader = createInputReader();
  const files = [join(changeDir, 'trace.md'), ...specFiles(changeDir, reader)].filter((p) => existsSync(p));
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
