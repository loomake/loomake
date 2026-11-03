import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInputReader, type InputReader } from '../runtime/input.js';

function copyInput(source: string, target: string, reader: InputReader): void {
  let stats;
  try { stats = lstatSync(source); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  if (stats.isDirectory()) {
    mkdirSync(target, { recursive: true });
    for (const entry of reader.entries(source)) copyInput(join(source, entry.name), join(target, entry.name), reader);
  } else {
    reader.read(source);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
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
