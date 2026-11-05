import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { runVerify, runExternal } from '@loomake/kit';
import { runRecord } from '../src/record.js';
import { summaryFixture } from './summary-fixture.js';

vi.mock('@loomake/kit', async (original) => {
  const kit = await original<typeof import('@loomake/kit')>();
  return { ...kit, runVerify: vi.fn(), runExternal: vi.fn() };
});
const roots: string[] = [];
const sha = 'a'.repeat(40);
function fixture(config: boolean = true) {
  const root = mkdtempSync(join(tmpdir(), 'loomake-summary-record-')); roots.push(root);
  const write = (path: string, text: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  write('openspec/changes/sample/trace.md', '# Trace\n');
  if (config) write('loomake.config.json', JSON.stringify({ commands: { secretCustom: 'echo PRIVATE_COMMAND_TEXT' } }));
  return { root, write };
}
function saved(root: string) {
  const path = join(root, '.loomake/evidence/sample'); const files = readdirSync(path); expect(files).toHaveLength(1);
  return JSON.parse(readFileSync(join(path, files[0]), 'utf8'));
}
beforeEach(() => {
  vi.mocked(runVerify).mockReset().mockReturnValue(summaryFixture().verify);
  vi.mocked(runExternal).mockReset().mockImplementation((_command, args) => ({ status: 0, signal: null, stdout: args[0] === 'rev-parse' ? sha : args[0] === 'show' ? '2026-11-05T00:00:00Z' : '', stderr: '' }));
});
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('recordの実行事実', () => {
  it('[REQ-460][REQ-461] 既存verifyを1回だけ呼びCI識別・元SHA・参照hashと未観測gapを保存する', () => {
    const repo = fixture(); const onVerify = vi.fn();
    expect(runRecord({ root: repo.root, changeId: 'sample', stdout: () => {}, onVerify, env: { GITHUB_ACTIONS: 'true', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2' }, now: () => new Date('2026-11-05T01:00:00Z') })).toBe(0);
    const e = saved(repo.root); expect(e).toMatchObject({ schemaVersion: 2, summaryVersion: 1, role: 'development', sha, ci: { runId: '123', runAttempt: 2, source: 'environment' }, request: null, observation: null });
    expect(e.execution.commands).toEqual({ source: 'loomake.config.json', sha256: createHash('sha256').update(readFileSync(join(repo.root, 'loomake.config.json'))).digest('hex'), nameRefs: null });
    expect(JSON.stringify(e)).not.toContain('PRIVATE_COMMAND_TEXT'); expect(JSON.stringify(e)).not.toContain('secretCustom');
    expect(e.execution.id).toMatch(/^[a-f0-9-]{36}$/); expect(e.execution.origin).toBe('github-actions');
    expect(e.execution.evaluator).toMatchObject({ name: '@loomake/trace', version: '0.0.0' });
    expect(e.execution.basisSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(e.gaps.some((g: { field: string }) => g.field === 'execution.commands.nameRefs')).toBe(true);
    expect(onVerify).toHaveBeenCalledTimes(1); expect(runVerify).toHaveBeenCalledTimes(1);
    expect(onVerify).toHaveBeenCalledWith(e.verify);
  });
  it.each([{}, { GITHUB_ACTIONS: 'true' }, { GITHUB_ACTIONS: 'true', GITHUB_RUN_ID: 'abc', GITHUB_RUN_ATTEMPT: '1' }, { GITHUB_ACTIONS: 'true', GITHUB_RUN_ID: '1', GITHUB_RUN_ATTEMPT: '9007199254740992' }])('[REQ-461] 不完全なCI識別はnullと理由を残す', (env) => {
    const repo = fixture(); runRecord({ root: repo.root, changeId: 'sample', env, stdout: () => {} });
    const e = saved(repo.root); expect(e.ci).toBeNull(); expect(e.gaps.filter((g: { field: string }) => g.field === 'ci')).toHaveLength(1);
  });
  it('[REQ-461] 設定省略でも既定値を受け付け空文字hashや実訪問を作らない', () => {
    const repo = fixture(false); expect(runRecord({ root: repo.root, changeId: 'sample', env: {}, stdout: () => {} })).toBe(0);
    expect(saved(repo.root).execution.commands).toEqual({ source: 'defaults', sha256: null, nameRefs: null });
  });
});
