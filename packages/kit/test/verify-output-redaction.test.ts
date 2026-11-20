import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { assembleVerifyResult, formatVerifyResult, runVerify, UsageError, verifyAbortedResult, verifyExitCode } from '@loomake/kit';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import * as runtime from '../src/runtime/process.js';
import type { ExternalResult } from '../src/runtime/process.js';
import { CHANGE, withProject } from './project.js';

const { command } = vi.hoisted(() => ({ command: vi.fn<(name: string) => ExternalResult>() }));
vi.mock('node:child_process', async original => {
  const actual = await original<typeof import('node:child_process')>();
  return { ...actual, spawnSync: (name: string, ...args: unknown[]) => name.startsWith('quality-')
    ? command(name) : Reflect.apply(actual.spawnSync, actual, [name, ...args]) };
});

// 明らかな偽物をテストの中で組み立てる
const token = 'ghp_' + 'x'.repeat(24);
const result = (values: Partial<ExternalResult> = {}): ExternalResult => ({ status: 0, signal: null, stdout: '', stderr: '', ...values });
const config = (commands: Record<string, string> = { test: 'quality-test' }) => ({ openspecValidate: false, commands });
const checksOf = (verified: ReturnType<typeof runVerify>) => ('checks' in verified ? verified.checks : undefined) ?? [];
const reasons = (verified: ReturnType<typeof runVerify>) => checksOf(verified).map(check => check.reason).join('\n');

beforeEach(() => {
  command.mockReset().mockImplementation(() => result());
  vi.spyOn(runtime, 'hasProcessBudget').mockReturnValue(false);
  vi.spyOn(runtime, 'holderWaitTime').mockReturnValue(0);
});
afterEach(() => vi.restoreAllMocks());

it('[REQ-451] 失敗した品質コマンドの出力にあるトークンを伏せ、判定と終了コードは変えない', () => withProject({ config: config() }, root => {
  command.mockReturnValue(result({ status: 1, stderr: `fail ${token}\n` }));
  const verified = runVerify({ root });
  expect(reasons(verified)).not.toContain(token);
  expect(reasons(verified)).toContain('fail ***');
  expect(verifyExitCode(verified)).toBe(1);
}));

it('[REQ-451] 末尾 30 行へ切る前に秘密鍵ブロックを置換し、上限は変えない', () => withProject({ config: config() }, root => {
  const body = Array.from({ length: 40 }, (_, i) => `DUMMY_BODY_${i}`);
  const key = ['-----BEGIN PRIVATE KEY-----', ...body, '-----END PRIVATE KEY-----'].join('\n');
  command.mockReturnValue(result({ status: 1, stdout: `${key}\n` }));
  expect(reasons(runVerify({ root }))).not.toContain('DUMMY_BODY');
  const plain = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n');
  command.mockReturnValue(result({ status: 1, stdout: plain }));
  expect(reasons(runVerify({ root })).split('\n')).toEqual(plain.split('\n').slice(-30));
}));

/** 偽の openspec が出力を返す環境で verify を実行し、openspec validate の reason を返す */
function openspecReason(root: string, output: string): string {
  const bin = mkdtempSync(join(tmpdir(), 'fake-openspec-'));
  writeFileSync(join(bin, 'openspec.cjs'), `process.stdout.write(${JSON.stringify(output)}); process.exit(1);`);
  writeFileSync(join(bin, 'openspec'), `#!/bin/sh\nexec node "$(dirname "$0")/openspec.cjs"\n`, { mode: 0o755 });
  writeFileSync(join(bin, 'openspec.cmd'), '@node "%~dp0openspec.cjs"\r\n');
  vi.stubEnv('PATH', `${bin}${delimiter}${process.env.PATH ?? ''}`);
  try {
    return checksOf(runVerify({ root, changeId: CHANGE })).find(check => check.id === 'openspec validate')?.reason ?? '';
  } finally { vi.unstubAllEnvs(); rmSync(bin, { recursive: true, force: true }); }
}
const openspecProject = { config: { openspecValidate: true, commands: {} } };

it('[REQ-451] openspec validate の失敗出力を置換し、先頭 2000 文字の上限は変えない', () => withProject(openspecProject, root => {
  const text = openspecReason(root, `bad ${token} ${'a'.repeat(3000)}`);
  expect(text).not.toContain(token);
  expect(text).toContain('bad ***');
  expect(text.length).toBeLessThanOrEqual(2000);
}));

it('[REQ-451] 先頭 2000 文字の切れ目をまたぐトークンは、切る前に置換して一部も残さない', () => withProject(openspecProject, root => {
  const text = openspecReason(root, `${'a'.repeat(1989)} ${token} ${'b'.repeat(500)}`);
  expect(text).not.toContain('ghp_');
}));

it('[REQ-451] 先頭 2000 文字の切れ目で END 行が落ちる秘密鍵ブロックも、本文を残さない', () => withProject(openspecProject, root => {
  const key = ['-----BEGIN PRIVATE KEY-----', ...Array.from({ length: 40 }, (_, i) => `DUMMY_BODY_${i}`), '-----END PRIVATE KEY-----'].join('\n');
  const text = openspecReason(root, `${'a'.repeat(1900)}\n${key}`);
  expect(text).not.toContain('DUMMY_BODY');
}));

it('[REQ-451] 進捗に出すコマンドの文字列を置換し、コマンドは設定どおりに実行する', () => withProject({ config: config({ test: `quality-test ${token}` }) }, root => {
  const lines: string[] = [];
  runVerify({ root, progress: line => lines.push(line) });
  expect(lines.join('\n')).not.toContain(token);
  expect(lines.join('\n')).toContain('***');
  expect(command).toHaveBeenCalledWith(`quality-test ${token}`);
}));

it('[REQ-451] 実行エラーと中止の message を置換し、分類は置換前の message で決める', () => {
  const error = { kind: 'runtime' as const, target: 't', message: `boom ${token}`, next: 'n' };
  const assembled = assembleVerifyResult({ change: null, scope: 'local', checks: [], errors: [error] });
  expect(JSON.stringify(assembled)).not.toContain(token);
  const aborted = verifyAbortedResult(new UsageError(`loomake.config.json ${token}`), null);
  expect(JSON.stringify(aborted)).not.toContain(token);
  expect(aborted.run.errors[0]?.kind).toBe('config');
});

it('[REQ-451] 早期の aborted の戻り値を置換する', () => withProject({ config: config({}), quality: `a: [\n${token}` }, root => {
  const verified = runVerify({ root, changeId: CHANGE, gate: 'done', scope: 'ci', qualitySchema: { safeParse: () => ({ success: true, data: {} }) } as never });
  expect(verified.run.status).toBe('aborted');
  expect(JSON.stringify(verified)).not.toContain(token);
}));

it('[REQ-451] 整形した文字列を置換し、秘密のない文章は変えない', () => {
  const secret = assembleVerifyResult({ change: null, scope: 'local', checks: [{ id: 'x', result: 'FAIL', reason: `r ${token}`, evidence: [] }] });
  expect(formatVerifyResult(secret)).not.toContain(token);
  const plain = assembleVerifyResult({ change: null, scope: 'local', checks: [{ id: 'x', result: 'FAIL', reason: 'plain', evidence: [] }] });
  expect(formatVerifyResult(plain)).toContain('plain');
});

it('[REQ-451] 秘密のない出力は変えない', () => withProject({ config: config() }, root => {
  command.mockReturnValue(result({ status: 1, stderr: 'plain failure\n' }));
  const lines: string[] = [];
  expect(reasons(runVerify({ root, progress: line => lines.push(line) }))).toBe('plain failure');
  expect(lines).toEqual(['… test: quality-test']);
}));
