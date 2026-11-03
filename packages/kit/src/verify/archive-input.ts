import { lstatSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { UsageError } from '../runtime/errors.js';
import { createInputReader, DOCUMENT_LIMITS, type InputReader } from '../runtime/input.js';

function copyInput(source: string, target: string, reader: InputReader, depth = 0): void {
  let stats;
  try { stats = lstatSync(source); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  if (stats.isDirectory()) {
    if (depth > DOCUMENT_LIMITS.maxDepth) throw new UsageError(`入力を読み取れません：探索の深さの上限は${DOCUMENT_LIMITS.maxDepth}です（${source}）`);
    mkdirSync(target, { recursive: true });
    for (const entry of reader.entries(source)) copyInput(join(source, entry.name), join(target, entry.name), reader, depth + 1);
  } else {
    const text = reader.read(source);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
}

export function createArchiveInput(root: string, changeDir: string, id: string) {
  const stage = mkdtempSync(join(tmpdir(), 'loomake-archive-strict-'));
  const cleanup = () => rmSync(stage, { recursive: true, force: true });
  try {
    const reader = createInputReader();
    for (const name of ['specs', 'schemas', 'config.yaml', 'config.yml']) {
      copyInput(join(root, 'openspec', name), join(stage, 'openspec', name), reader);
    }
    copyInput(changeDir, join(stage, 'openspec', 'changes', id), reader);
    return { cwd: stage, cleanup };
  } catch (error) { cleanup(); throw error; }
}
