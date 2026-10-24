import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { main } from '../src/main.js';
import { CHANGE, reportJson, withProject } from '../../kit/test/project.js';

async function run(root: string, ...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

const withReport = <T>(fn: (root: string) => T) =>
  withProject({}, (root) => {
    mkdirSync(join(root, '.loomake'), { recursive: true });
    writeFileSync(join(root, '.loomake', 'test-report.json'), reportJson(root, { 'tests/a.test.ts': [['[REQ-012] 動く', 'passed']] }));
    return fn(root);
  });

describe('品質コマンドを省いたことの表示', () => {
  it('[REQ-191] --json でも、results に品質コマンドの skip の項目が含まれる', async () => {
    const r = await withReport((root) => run(root, 'verify', '--change', CHANGE, '--done', '--skip-commands', '--json'));
    expect(JSON.parse(r.stdout).results).toContainEqual(expect.objectContaining({ check: '品質コマンド', status: 'skip' }));
  });
});

describe('値をとるオプションの書き方', () => {
  it('[REQ-194] --change=<id> は --change <id> と同じ結果になる', async () => {
    const [eq, space] = await withProject({}, async (root) => [
      await run(root, 'verify', `--change=${CHANGE}`, '--spec-only'),
      await run(root, 'verify', '--change', CHANGE, '--spec-only'),
    ]);
    expect(eq.code).toBe(space.code);
    expect(eq.stdout).toBe(space.stdout);
  });

  it('[REQ-194] trace の --format=json も受け付ける', async () => {
    const r = await withProject({}, (root) => run(root, 'trace', 'report', `--change=${CHANGE}`, '--format=json'));
    expect(r.stderr).not.toContain('知らないオプション');
  });

  it('[REQ-194] 等号の形では、-- で始まる値もそのまま値として渡す', async () => {
    const r = await withProject({}, (root) => run(root, 'verify', '--change=--x', '--spec-only'));
    expect(r.stderr).not.toContain('値を続けてください');
    expect(r.stderr).toContain('change-id「--x」');
  });

  it('[REQ-194] --change= のように値が空なら、値を続けるよう示して終了コード 2', async () => {
    const r = await withProject({}, (root) => run(root, 'verify', '--change=', '--spec-only'));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('--change には値を続けてください');
  });
});

describe('打ち間違いの候補', () => {
  it('[REQ-195] サブコマンドの打ち間違いに、近い候補を示して終了コード 2', async () => {
    const r = await withProject({}, (root) => run(root, 'verfy'));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('もしかして：verify');
  });

  it('[REQ-195] オプションの打ち間違いに、近い候補を示して終了コード 2', async () => {
    const r = await withProject({}, (root) => run(root, 'verify', '--chnage', CHANGE, '--spec-only'));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('もしかして：--change');
  });

  it('[REQ-195] 近い候補がなければ、候補を示さない', async () => {
    const r = await withProject({}, (root) => run(root, 'zzzzzzzz'));
    expect(r.code).toBe(2);
    expect(r.stderr).not.toContain('もしかして');
  });
});
