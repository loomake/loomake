import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, lstatSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../src/main.js';

async function project(fn: (root: string) => Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), 'loomake-cli-input-'));
  try { await fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
async function run(root: string, args: string[]) {
  const stdout: string[] = []; const stderr: string[] = [];
  const code = await main(args, { cwd: root, stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text), interactive: false });
  return { code, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
}

it('[REQ-424][REQ-311] reports an external report path as config aborted JSON with exit 2 without deleting it', async () => project(async (root) => {
  mkdirSync(join(root, 'project')); writeFileSync(join(root, 'outside.json'), 'untouched');
  const projectRoot = join(root, 'project');
  writeFileSync(join(projectRoot, 'loomake.config.json'), JSON.stringify({ tests: { report: '../outside.json' } }));
  const result = await run(projectRoot, ['verify', '--change', 'c1', '--done', '--json']);
  expect(result.code).toBe(2);
  expect(JSON.parse(result.stdout)).toMatchObject({ change: 'c1', run: { status: 'aborted', errors: [expect.objectContaining({ kind: 'config', message: expect.stringContaining('tests.report') })] } });
  expect(readFileSync(join(root, 'outside.json'), 'utf8')).toBe('untouched');
}));

it('[REQ-425][REQ-421] gives an external link priority over an invalid target type with exit 1 and no writes', async () => project(async (root) => {
  const projectRoot = join(root, 'project'); mkdirSync(projectRoot);
  writeFileSync(join(root, 'outside.md'), 'untouched');
  symlinkSync(join(root, 'outside.md'), join(projectRoot, 'AGENTS.md'));
  mkdirSync(join(projectRoot, '.gitignore'));
  const result = await run(projectRoot, ['init', '--yes']);
  expect(result.code).toBe(1);
  expect(result.stdout).toContain('シンボリックリンク');
  expect(readdirSync(projectRoot).sort()).toEqual(['.gitignore', 'AGENTS.md']);
  expect(lstatSync(join(projectRoot, '.gitignore')).isDirectory()).toBe(true);
  expect(lstatSync(join(projectRoot, 'AGENTS.md')).isSymbolicLink()).toBe(true);
  expect(readFileSync(join(root, 'outside.md'), 'utf8')).toBe('untouched');
}));
