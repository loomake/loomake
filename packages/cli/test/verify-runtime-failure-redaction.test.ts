import { expect, it, vi } from 'vitest';
import { RuntimeFailure } from '@loomake/kit';
import { main } from '../src/main.js';
import { withProject } from '../../kit/test/project.js';

// 明らかな偽物をテストの中で組み立てる
const token = 'ghp_' + 'x'.repeat(24);

vi.mock('@loomake/kit', async original => ({
  ...(await original<typeof import('@loomake/kit')>()),
  runVerify: () => { throw new RuntimeFailure(`read failed ${token}`); },
}));

async function run(root: string, ...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: text => out.push(text), stderr: text => err.push(text) });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

it('[REQ-451] 実行時の失敗の標準エラーを置換し、終了コードは 3 のままにする', () => withProject({}, async root => {
  const { code, stdout, stderr } = await run(root, 'verify', '--spec-only', '--change', 'c1');
  expect(code).toBe(3);
  expect(stderr).toContain('loomake verify: read failed ***');
  expect(stderr).not.toContain(token);
  expect(stdout).not.toContain(token);
}));

it('[REQ-451] --json の実行時の失敗は、標準出力が置換済みの aborted で、標準エラーも置換し、終了コードは 3', () => withProject({}, async root => {
  const { code, stdout, stderr } = await run(root, 'verify', '--json', '--spec-only', '--change', 'c1');
  expect(code).toBe(3);
  expect(JSON.parse(stdout).run.status).toBe('aborted');
  expect(stdout).not.toContain(token);
  expect(stderr).not.toContain(token);
}));

it('[REQ-451] --json の実行時の失敗でも、秘密の形の change ID は標準出力に残らない', () => withProject({}, async root => {
  const id = 'sk-' + 'a'.repeat(20);
  const { code, stdout } = await run(root, 'verify', '--json', '--spec-only', '--change', id);
  expect(code).toBe(3);
  expect(stdout).not.toContain(id);
  expect(JSON.parse(stdout).change).toBe('***');
}));
