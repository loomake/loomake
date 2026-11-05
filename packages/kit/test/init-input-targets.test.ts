import * as fs from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/init/init.js';
vi.mock('node:fs', async (original) => ({ ...await original<typeof fs>(), lstatSync: vi.fn((await original<typeof fs>()).lstatSync) }));
async function project(fn: (root: string) => Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), 'loomake-init-target-'));
  try { await fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
const init = (root: string, existingFiles: 'keep' | 'overwrite' = 'keep') => runInit({ root, existingFiles, interactive: false, confirm: async () => false, stdout: () => {} });
describe('init input targets', () => {
  it('[REQ-425] rejects directory targets and file ancestors without partial writes', async () => {
    for (const path of ['AGENTS.md', '.gitignore', '.claude', '.github']) await project(async (root) => {
      if (path.startsWith('.') && path !== '.gitignore') writeFileSync(join(root, path), 'file');
      else mkdirSync(join(root, path));
      await expect(init(root)).rejects.toThrow(path === 'AGENTS.md' || path === '.gitignore' ? /ディレクトリです.*移動するか削除/ : /途中の要素がディレクトリではありません.*移動するか削除/);
      expect(readdirSync(root)).toEqual([path]);
    });
  });
  it('[REQ-426] validates retained reports before writing and repairs overwritten invalid reports', async () => {
    await project(async (root) => {
      writeFileSync(join(root, 'loomake.config.json'), JSON.stringify({ tests: { report: '../outside' } }));
      await expect(init(root)).rejects.toThrow(/tests.report/);
      expect(readdirSync(root)).toEqual(['loomake.config.json']);
      expect(await init(root, 'overwrite')).toBe(0);
      expect(JSON.parse(readFileSync(join(root, 'loomake.config.json'), 'utf8')).tests.report).toBe('.loomake/test-report.json');
    });
  });
  it('[REQ-426][REQ-133] ignores normalized literal names and remains idempotent', async () => {
    for (const report of ['#r.json', '!r.json', '!d/r.json', ' lead.json', 'tail.json ', 'a[1]*?.json', './a\\b//./r.json']) await project(async (root) => {
      execFileSync('git', ['init', '--quiet'], { cwd: root });
      writeFileSync(join(root, 'loomake.config.json'), JSON.stringify({ tests: { report } }));
      expect(await init(root)).toBe(0);
      const before = readFileSync(join(root, '.gitignore'), 'utf8');
      expect(await init(root)).toBe(0);
      expect(readFileSync(join(root, '.gitignore'), 'utf8')).toBe(before);
      const normalized = report.replace(/\\/g, '/').split('/').filter((p) => p && p !== '.').join('/');
      execFileSync('git', ['check-ignore', '--', normalized], { cwd: root });
      expect(() => execFileSync('git', ['check-ignore', '--', `nested/${normalized}`], { cwd: root, stdio: 'pipe' })).toThrow();
    });
  });
});

it('[REQ-425] rejects a non-regular destination with a distinct diagnosis before writes', async () => project(async (root) => {
  writeFileSync(join(root, 'AGENTS.md'), 'existing');
  const native = await vi.importActual<typeof fs>('node:fs');
  vi.mocked(fs.lstatSync).mockImplementation((path, options) => path === join(root, 'AGENTS.md')
    ? { isSymbolicLink: () => false, isDirectory: () => false, isFile: () => false } as fs.Stats
    : native.lstatSync(path, options));
  try {
    await expect(init(root)).rejects.toThrow(/通常のファイルではありません.*移動するか削除/);
    expect(readdirSync(root)).toEqual(['AGENTS.md']);
  } finally { vi.mocked(fs.lstatSync).mockImplementation(native.lstatSync); }
}));
it('[REQ-424][REQ-426] validates default report targets before any init writes', async () => {
  for (const configured of [false, true]) await project(async (root) => {
    mkdirSync(join(root, '.loomake', 'test-report.json'), { recursive: true });
    if (configured) writeFileSync(join(root, 'loomake.config.json'), '{}');
    await expect(init(root)).rejects.toThrow(/tests.report/);
    expect(readdirSync(root).sort()).toEqual(configured ? ['.loomake', 'loomake.config.json'] : ['.loomake']);
  });
});
