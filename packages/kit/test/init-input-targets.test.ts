import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/init/init.js';
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
      await expect(init(root)).rejects.toThrow(/移動するか削除/);
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
