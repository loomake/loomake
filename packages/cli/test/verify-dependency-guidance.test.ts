import { afterEach, expect, it, vi } from 'vitest';
import { realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadVerifyResultSchemas } from '@loomake/core';
import { main } from '../src/main.js';
import * as input from '../../kit/src/runtime/input.js';
import { ProcessLimitError } from '../../kit/src/runtime/process.js';
import { CHANGE, COPY_REPORT, commitAll, reportJson, traceMd, withProject } from '../../kit/test/project.js';
const { verifyResultSchema } = await loadVerifyResultSchemas();
const trace = traceMd() + '\n## 依存する成果物\n| ID | 関連 | 種類 | 依存先 | 提供元 | 期待blob | CI |\n|---|---|---|---|---|---|---|\n| D-01 | REQ-012 | change | producer | | | |\n';
async function cli(root: string, ...args: string[]) {
  const out: string[] = [], err: string[] = [];
  const code = await main(['verify', '--change', CHANGE, ...args], { cwd: root, stdout: t => out.push(t), stderr: t => err.push(t) });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}
it.each(['spec-only', 'done'] as const)('[REQ-401] CLI %s keeps notice, JSON-only stdout, schema and exit consistent', async gate => withProject({ trace, quality: true, config: { openspecValidate: false, commands: { test: COPY_REPORT } } }, async root => {
  writeFileSync(join(root, 'report-src.json'), reportJson(root, { 'tests/a.test.ts': [['[REQ-012] works', 'passed']] })); commitAll(root);
  const text = await cli(root, `--${gate}`), json = await cli(root, `--${gate}`, '--json');
  expect([text.code, json.code]).toEqual(gate === 'spec-only' ? [0, 0] : [1, 1]);
  expect(text.stdout).toContain(gate === 'spec-only' ? '! 依存する成果物' : '依存する成果物');
  const r = JSON.parse(json.stdout); expect(verifyResultSchema.safeParse(r).success).toBe(true); expect(r.schemaVersion).toBe('2.0.0');
  expect(r.checks.find((c: { id: string }) => c.id === '依存する成果物')).toMatchObject({ result: gate === 'spec-only' ? 'PASS' : 'INSUFFICIENT_EVIDENCE', reason: expect.stringContaining('D-01 change producer（未確認）') });
  expect(json.stdout).not.toMatch(/回答の書き方|承認の書き方/); expect(r.decision.required).toBe(false); expect(r.run.errors).toEqual([]);
}));
it('[REQ-401] CLI preserves mutually exclusive gate usage errors', async () => withProject({ trace }, async root => {
  const usage = await cli(root, '--spec-only', '--done', '--json');
  expect(usage.code).toBe(2); expect(JSON.parse(usage.stdout).run.status).toBe('aborted');
}));
afterEach(() => vi.restoreAllMocks());
it('[REQ-401] CLI preserves an interrupted input as aborted runtime/3', async () => withProject({ trace }, async root => {
  const original = input.createInputReader;
  vi.spyOn(input, 'createInputReader').mockImplementation(limits => { const reader = original(limits), read = reader.read; return { ...reader, read: p => { if (p === join(realpathSync(root), 'openspec/changes', CHANGE, 'trace.md')) throw new ProcessLimitError('interrupted', 'trace'); return read(p); } }; });
  const r = await cli(root, '--spec-only', '--json'); expect(r.code).toBe(3);
  const result = JSON.parse(r.stdout); expect(result.run.status).toBe('aborted'); expect(result.run.errors[0].kind).toBe('runtime'); expect(result).not.toHaveProperty('checks');
}));
