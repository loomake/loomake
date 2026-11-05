import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { runVerify, runExternal, readInputBytes, InputReadFailure, UsageError } from '@loomake/kit';
import { readInputBytes as rawRead } from '../../kit/src/runtime/input.js';
import { runRecord } from '../src/record.js';
import { summaryFixture } from './summary-fixture.js';

vi.mock('@loomake/kit', async (original) => {
  const kit = await original<typeof import('@loomake/kit')>();
  return { ...kit, runVerify: vi.fn(), readInputBytes: vi.fn(kit.readInputBytes), runExternal: vi.fn() };
});
const roots: string[] = [];
const sha = 'a'.repeat(40);
function fixture(config: boolean = true) {
  const root = mkdtempSync(join(tmpdir(), 'loomake-summary-record-')); roots.push(root);
  const write = (path: string, text: string | Uint8Array) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  write('openspec/changes/sample/trace.md', '# Trace\n');
  if (config) write('loomake.config.json', JSON.stringify({ commands: { secretCustom: 'echo PRIVATE_COMMAND_TEXT' } }));
  return { root, write };
}
function saved(root: string) {
  const path = join(root, '.loomake/evidence/sample'); const files = readdirSync(path); expect(files).toHaveLength(1);
  return JSON.parse(readFileSync(join(path, files[0]), 'utf8'));
}
beforeEach(() => {
  vi.mocked(readInputBytes).mockReset().mockImplementation(rawRead);
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

const reportPath = '.loomake/test-report.json';
function observedReport() {
  return JSON.stringify({ startTime: Date.now(), numTotalTests: 6, success: true, testResults: [{ name: 'tests/observed.test.ts', status: 'passed', assertionResults: ['passed', 'failed', 'skipped', 'todo', 'pending', 'unfamiliar'].map((status) => ({ fullName: '[REQ-462] 観測', status })) }] });
}
function observed(repo: ReturnType<typeof fixture>, create: () => string | Uint8Array, options: { wrongHash?: boolean; commandFailure?: boolean; local?: boolean; emptyHash?: boolean } = {}) {
  vi.mocked(runVerify).mockImplementation(() => {
    const raw = create(); repo.write(reportPath, raw);
    const hash = options.emptyHash ? createHash('sha256').update('').digest('hex') : options.wrongHash ? '0'.repeat(64) : createHash('sha256').update(typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8')).digest('hex');
    const checks = [{ id: 'command: test', result: options.commandFailure ? 'FAIL' as const : 'PASS' as const, reason: '', evidence: [] }, { id: 'quality:PQ-900', result: 'PASS' as const, reason: '', evidence: [`report:sha256:${hash}`, 'producer:vitest@5.0.5'] }];
    return options.local ? { schemaVersion: '2.0.0', change: 'sample', scope: 'local', run: { status: 'completed', errors: [] }, checks, summary: { fail: 0, insufficient: 0, not_applicable: 0, evaluated: 2, pending: 0 }, decision: { required: false, reasons: [] } } : { schemaVersion: '2.0.0', change: 'sample', scope: 'ci', run: { status: 'completed', errors: [] }, checks, verdict: options.commandFailure ? 'FAIL' : 'PASS', summary: { fail: options.commandFailure ? 1 : 0, insufficient: 0, not_applicable: 0, evaluated: 2 }, decision: { required: false, reasons: [] } };
  });
}
describe('recordの本体照合', () => {
  it('[REQ-462] 同実行のraw hash・期間を照合し6件数だけを保存し、本体と配置事実を捏造しない', () => {
    const repo = fixture(); observed(repo, observedReport);
    expect(runRecord({ root: repo.root, changeId: 'sample', env: {}, stdout: () => {} })).toBe(0);
    const e = saved(repo.root); const a = e.artifacts[0];
    expect(a).toMatchObject({ kind: 'test-report', path: reportPath, sameRun: { status: 'verified' }, counts: { passed: 1, failed: 1, skipped: 1, todo: 1, pending: 1, other: 1 }, availability: 'not-uploaded', location: null, retrieval: null, expiresAt: null });
    const raw = readFileSync(join(repo.root, reportPath)); expect(a.sha256).toBe(createHash('sha256').update(raw).digest('hex')); expect(a.bytes).toBe(raw.length);
    expect(JSON.stringify(e)).not.toContain('assertionResults'); expect(runVerify).toHaveBeenCalledTimes(1);
    expect(e.execution.producer).toEqual({ name: 'vitest', version: '5.0.5' });
  });
  it.each([{ wrongHash: true }, { emptyHash: true }])('[REQ-462] 比較可能な既知hash不一致なら公開前に1で拒否する', (options) => {
    const repo = fixture(); observed(repo, observedReport, options); const out: string[] = [];
    expect(runRecord({ root: repo.root, changeId: 'sample', env: {}, stdout: (s) => out.push(s) })).toBe(1);
    expect(out.join('\n')).toContain('ハッシュが一致しない');
    expect(() => readdirSync(join(repo.root, '.loomake/evidence/sample'))).toThrow();
  });
  it('[REQ-462] onVerify後の本体差替えも拒否し、通知の回数と順序を保つ', () => {
    const repo = fixture(); observed(repo, observedReport); const onVerify = vi.fn(() => repo.write(reportPath, '{}'));
    expect(runRecord({ root: repo.root, changeId: 'sample', env: {}, stdout: () => {}, onVerify })).toBe(1);
    expect(onVerify).toHaveBeenCalledTimes(1); expect(runVerify).toHaveBeenCalledTimes(1);
    expect(() => readdirSync(join(repo.root, '.loomake/evidence/sample'))).toThrow();
  });
  it.each([
    { label: 'local', options: { local: true }, body: observedReport },
    { label: '通常非0', options: { commandFailure: true }, body: observedReport },
    { label: '古い開始時刻', options: {}, body: () => JSON.stringify({ ...JSON.parse(observedReport()), startTime: 0 }) },
    { label: 'bailの部分出力', options: {}, body: () => JSON.stringify({ ...JSON.parse(observedReport()), success: false }) },
    { label: '登録総数と出力数の不一致', options: {}, body: () => JSON.stringify({ ...JSON.parse(observedReport()), numTotalTests: 7 }) },
    { label: '空の失敗ファイル', options: {}, body: () => JSON.stringify({ startTime: Date.now(), testResults: [{ name: 'failed.ts', status: 'failed', assertionResults: [] }] }) },
    { label: '不正UTF8', options: {}, body: () => Buffer.from([0x80, 0xe3, 0x81]) },
    { label: 'BOM', options: {}, body: () => '\uFEFF' + observedReport() },
  ])('[REQ-462] $label は観測未確認・counts:nullとし旧結果を変えない', ({ options, body }) => {
    const repo = fixture(); observed(repo, body, options);
    const code = runRecord({ root: repo.root, changeId: 'sample', env: {}, stdout: () => {} });
    expect(code).toBe(options.commandFailure ? 1 : 0);
    const e = saved(repo.root); expect(e.artifacts[0].sameRun.status).toBe('unverified'); expect(e.artifacts[0].counts).toBeNull();
    expect(e.gaps.filter((g: { field: string }) => g.field === 'artifacts[0].counts')).toHaveLength(1);
  });
  it('[REQ-462] 消えた本体を未取得のgapとして区別する', () => {
    const repo = fixture(); runRecord({ root: repo.root, changeId: 'sample', env: {}, stdout: () => {} });
    const e = saved(repo.root); expect(e.artifacts).toEqual([]); expect(e.gaps.find((g: { field: string }) => g.field === 'artifacts').reason).toContain('ありません');
  });
});

  it('[REQ-462] OS不読だけをgapとし入力拒否を握り潰さない', () => {
    const repo = fixture();
    vi.mocked(readInputBytes).mockImplementation((file, limits) => {
      if (file === join(repo.root, reportPath)) throw new InputReadFailure('非公開のOS診断', { cause: Object.assign(new Error('I/O'), { code: 'EACCES' }) });
      return rawRead(file, limits);
    });
    expect(runRecord({ root: repo.root, changeId: 'sample', env: {}, stdout: () => {} })).toBe(0);
    expect(saved(repo.root).gaps.find((g: { field: string }) => g.field === 'artifacts').reason).toBe('本体を読み取れません');
    const other = fixture();
    vi.mocked(readInputBytes).mockImplementation((file, limits) => { if (file === join(other.root, reportPath)) throw new UsageError('入力拒否'); return rawRead(file, limits); });
    expect(() => runRecord({ root: other.root, changeId: 'sample', env: {}, stdout: () => {} })).toThrow('入力拒否');
    expect(() => readdirSync(join(other.root, '.loomake/evidence/sample'))).toThrow();
  });
  it('[REQ-462] 不正UTF8でも空文字hashと非空rawの既知不整合を拒否する', () => {
    const repo = fixture(); observed(repo, () => Buffer.from([0x80]), { emptyHash: true });
    expect(runRecord({ root: repo.root, changeId: 'sample', env: {}, stdout: () => {} })).toBe(1);
    expect(() => readdirSync(join(repo.root, '.loomake/evidence/sample'))).toThrow();
  });
