import { describe, it, expect, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadVerifyResultSchemas } from '@loomake/core';
import { main } from '../src/main.js';
import { CHANGE, COPY_REPORT, reportJson, withProject } from '../../kit/test/project.js';

vi.setConfig({ testTimeout: 60_000 });

const { verifyResultSchema } = await loadVerifyResultSchemas();

// CI=1 で、確認を受け付けない（interactive も prompt もない）入出力で動かす
async function run(root: string, ...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const saved = process.env.CI;
  process.env.CI = '1';
  try {
    const code = await main(argv, { cwd: root, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
    return { code, stdout: out.join('\n'), stderr: err.join('\n') };
  } finally {
    if (saved === undefined) delete process.env.CI;
    else process.env.CI = saved;
  }
}

describe('verify 2.0.0 の出力と終了コード', () => {
  it('[REQ-311] CI=1 で、正常と不正の入力の終了コードは --json の有無によらず一致し、--json の標準出力は単独の JSON', async () => {
    const config = { openspecValidate: false, commands: { test: COPY_REPORT } };
    const cases: [string[], number][] = [
      [['--change', CHANGE, '--done'], 0],
      [['--change', CHANGE, '--spec-only'], 0],
      [['--spec-only'], 2],
      [['--change', '../x', '--spec-only'], 2],
      [['--change', CHANGE, '--spec-only', '--done'], 2],
      [['--change', CHANGE, '--done', '--skip-commands'], 1],
    ];
    await withProject({ config, quality: true }, async (root) => {
      writeFileSync(join(root, 'report-src.json'), reportJson(root, { 'tests/a.test.ts': [['[REQ-012] 動く', 'passed']] }));
      for (const [argv, code] of cases) {
        const text = await run(root, 'verify', ...argv);
        const json = await run(root, 'verify', ...argv, '--json');
        expect([text.code, json.code], argv.join(' ')).toEqual([code, code]);
        const parsed = JSON.parse(json.stdout);
        expect(verifyResultSchema.safeParse(parsed).success, json.stdout).toBe(true);
        expect(parsed.schemaVersion).toBe('2.0.0');
        if (code === 2) {
          expect(parsed.run.status).toBe('aborted');
          expect(parsed.run.errors[0].kind).toBe('usage');
          expect(json.stderr).toContain('使い方:');
          expect(text.stdout).toBe('');
        }
      }
    });
  });

  it('[REQ-311][REQ-041] 使い方の誤りは --json でも aborted を出して 2。change-id が確定しないときは change を null にし、入力を target に残す', async () => {
    const r = await withProject({}, (root) => run(root, 'verify', '--change', '../../packages', '--spec-only', '--json'));
    expect(r.code).toBe(2);
    const out = JSON.parse(r.stdout);
    expect(out).toEqual({
      schemaVersion: '2.0.0', change: null,
      run: { status: 'aborted', errors: [expect.objectContaining({ kind: 'usage', target: '../../packages', message: expect.stringContaining('パスの区切り') })] },
    });
    expect(r.stderr).toContain('change-id「../../packages」');
  });

  it('[REQ-311][REQ-041] loomake.config.json の誤りは config の aborted で 2。値として読まれた --json は単独の --json とみなさない', async () => {
    const files = { 'loomake.config.json': '{ "commands": [] }' };
    const [json, text] = await withProject({ files }, async (root) => [
      await run(root, 'verify', '--change', CHANGE, '--done', '--json'),
      await run(root, 'verify', '--change', '--json', '--done'),
    ]);
    expect(json.code).toBe(2);
    expect(JSON.parse(json.stdout).run.errors[0]).toMatchObject({ kind: 'config', target: CHANGE });
    expect(JSON.parse(json.stdout).change).toBe(CHANGE);
    expect(text.code).toBe(2);
    expect(text.stdout).toBe('');
  });
});
