import { expect, it, vi } from 'vitest';
import { main } from '../src/main.js';
import { CHANGE, withProject } from '../../kit/test/project.js';

vi.setConfig({ testTimeout: 60_000 });

// 明らかな偽物をテストの中で組み立てる
const token = 'ghp_' + 'x'.repeat(24);

async function run(root: string, ...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: text => out.push(text), stderr: text => err.push(text) });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

it('[REQ-451] verify の使い方の誤りの標準エラーを置換し、終了コードは 2 のままにする', () => withProject({}, async root => {
  const { code, stdout, stderr } = await run(root, 'verify', '--change', token, '--spec-only');
  expect(code).toBe(2);
  expect(stderr).not.toContain(token);
  expect(stderr).toContain('loomake verify:');
  expect(stdout).not.toContain(token);
}));

it('[REQ-451] --json のとき標準出力は置換済みの単独の JSON で、標準エラーも置換する', () => withProject({}, async root => {
  const { code, stdout, stderr } = await run(root, 'verify', '--json', '--change', token, '--spec-only');
  expect(code).toBe(2);
  expect(JSON.parse(stdout).run.status).toBe('aborted');
  expect(stdout).not.toContain(token);
  expect(stderr).not.toContain(token);
}));

it('[REQ-451] --json の標準出力に、秘密の形の change ID は残らない', () => withProject({}, async root => {
  const { stdout } = await run(root, 'verify', '--json', '--change', token, '--spec-only');
  expect(stdout).not.toContain(token);
  expect(JSON.parse(stdout).change).toBe('***');
}));

it('[REQ-451] 秘密のない使い方の誤りの表示は変えない', () => withProject({}, async root => {
  const { code, stderr } = await run(root, 'verify', '--change', CHANGE, '--spec-only', '--done');
  expect(code).toBe(2);
  expect(stderr).toContain('loomake verify: ');
  expect(stderr).toContain('使い方:');
}));
