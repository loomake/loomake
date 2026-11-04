import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProcessLimitError, runExternalBytes, withProcessBudget } from '../src/runtime/process.js';
import { fetchJob } from '../src/verify/ci-jobs.js';
import * as kit from '../src/index.js';

vi.mock('../src/runtime/process.js', async (original) => {
  const actual = await original<typeof import('../src/runtime/process.js')>();
  return { ...actual, runExternalBytes: vi.fn(actual.runExternalBytes) };
});
const raw = vi.mocked(runExternalBytes);
afterEach(() => { raw.mockReset(); vi.unstubAllEnvs(); });
// 監視役と偽の gh を実際に起動する。1 操作の 30 秒に、保持役の準備待ちと後片付けの各 10 秒を足しても収まる上限
vi.setConfig({ testTimeout: 60_000 });

const MiB = 1024 * 1024;
const PATH_PREFIX = 'repos/{owner}/{repo}/actions/jobs/';
// 偽の gh。引数・cwd・環境変数を記録し、job ごとの計画（pad 個の空白に続く stdout、hex なら 16 進、stderr、終了コード、wait）どおりに出力する
const FAKE_GH = `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.FAKE_JOB_LOG, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), repo: process.env.GH_REPO ?? null, other: process.env.FAKE_JOB_OTHER ?? null }) + '\\n');
const plan = JSON.parse(fs.readFileSync(process.env.FAKE_JOB_PLAN, 'utf8'))[process.argv[3].split('/').pop()] ?? {};
process.stdout.write(Buffer.concat([Buffer.alloc(plan.pad ?? 0, 0x20), Buffer.from(plan.stdout ?? '{}', plan.hex ? 'hex' : 'utf8')]));
process.stderr.write(plan.stderr ?? '');
if (plan.wait) setInterval(() => {}, 100); else process.exitCode = plan.status ?? 0;
`;
type Call = { args: string[]; cwd: string; repo: string | null; other: string | null };
type Plan = Record<string, { pad?: number; stdout?: string; hex?: boolean; stderr?: string; status?: number; wait?: boolean }>;

function fixture(action: (root: string, plan: (jobs: Plan) => void, calls: () => Call[]) => void) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loomake-ci-jobs-')));
  try {
    const bin = join(dir, 'bin');
    const root = join(dir, 'root');
    mkdirSync(bin);
    mkdirSync(root);
    writeFileSync(join(bin, 'gh'), FAKE_GH);
    chmodSync(join(bin, 'gh'), 0o755);
    writeFileSync(join(bin, 'gh.cmd'), '@node "%~dp0gh" %*\r\n');
    const log = join(dir, 'calls.jsonl');
    const planFile = join(dir, 'plan.json');
    writeFileSync(planFile, '{}');
    vi.stubEnv('PATH', `${bin}${delimiter}${process.env.PATH ?? ''}`);
    vi.stubEnv('FAKE_JOB_LOG', log);
    vi.stubEnv('FAKE_JOB_PLAN', planFile);
    action(root, (jobs) => writeFileSync(planFile, JSON.stringify(jobs)),
      () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as Call) : []));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
function thrown(action: () => unknown): unknown { try { action(); } catch (error) { return error; } return undefined; }
const kindOf = (error: unknown) => (error instanceof ProcessLimitError ? error.kind : error);
const errno = (code: string) => Object.assign(new Error(code), { code });
const none = Buffer.alloc(0);

describe('宣言した CI job の 1 回の内部取得', () => {
  it('[REQ-415] root から gh api の固定 path だけで 1 回呼び、JSON の値を検証せずに出力のバイト数と返す', () => fixture((root, plan, calls) => {
    plan({ 1: { stdout: 'null' }, 2: { stdout: '[1,"a"]', stderr: 'warn' }, 3: { stdout: '{"id":"x","status":5}' }, 4: { stdout: '"text"' } });
    expect(['1', '2', '3', '4'].map((job) => fetchJob(root, job))).toEqual([
      { result: { kind: 'fetched', job: '1', value: null }, bytes: 4 },
      { result: { kind: 'fetched', job: '2', value: [1, 'a'] }, bytes: 11 },
      { result: { kind: 'fetched', job: '3', value: { id: 'x', status: 5 } }, bytes: 21 },
      { result: { kind: 'fetched', job: '4', value: 'text' }, bytes: 6 },
    ]);
    expect(calls().map(({ args, cwd }) => ({ args, cwd }))).toEqual(['1', '2', '3', '4'].map((job) => ({ args: ['api', `${PATH_PREFIX}${job}`], cwd: root })));
    expect(['fetchJob', 'jobDigits'].filter((name) => Reflect.has(kit, name))).toEqual([]);
  }));
  it('[REQ-415] 先頭の 0 だけを除いた桁で path を作り、改行や cmd の記号を含む数字以外を起動前に拒否する', () => fixture((root, _plan, calls) => {
    const big = '12345678901234567890123';
    const jobs = ['0', '0', '7', big, big];
    expect(['000', '0', '007', big, `00${big}`].map((job) => fetchJob(root, job).result.job)).toEqual(jobs);
    expect(calls().map(({ args }) => args[1])).toEqual(jobs.map((job) => `${PATH_PREFIX}${job}`));
    for (const job of ['', '1a', '-1', '+1', ' 1', '１', '1.0', '1e3', '1\n', '1\r', '1\r\n', '1\u2028', '1\u2029', '\n1', '1&echo']) {
      expect(() => fetchJob(root, job)).toThrow('CI の job の数字ではありません');
    }
    expect(calls()).toHaveLength(5);
  }));
  it('[REQ-415] GH_REPO を渡さず、ほかの環境変数を引き継ぎ、値と本文を結果に含めない', () => fixture((root, plan, calls) => {
    vi.stubEnv('GH_REPO', 'other-owner/other-repo');
    vi.stubEnv('FAKE_JOB_OTHER', 'kept');
    plan({ 2: { stdout: 'body-secret', stderr: 'stderr-secret', status: 1 } });
    const results = [fetchJob(root, '1'), fetchJob(root, '2')];
    expect(calls().map(({ repo, other }) => ({ repo, other }))).toEqual([{ repo: null, other: 'kept' }, { repo: null, other: 'kept' }]);
    expect(JSON.stringify(results)).not.toMatch(/other-owner|secret/);
  }));
  it('[REQ-415] gh の不存在・0 以外の終了・JSON として読めない応答を例外なしの取得不能にし、出力のバイト数を返す', () => fixture((root, plan) => {
    plan({ 1: { stdout: 'ab', stderr: 'cde', status: 3 }, 2: { stdout: '{' }, 3: { stdout: 'efbbbf7b7d', hex: true }, 4: { stdout: '' }, 5: { stdout: '7b2261223a22ff227d', hex: true } });
    expect(['1', '2', '3', '4'].map((job) => fetchJob(root, job))).toEqual([
      { result: { kind: 'unavailable', job: '1', reason: 'exit' }, bytes: 5 },
      { result: { kind: 'unavailable', job: '2', reason: 'json' }, bytes: 1 },
      { result: { kind: 'unavailable', job: '3', reason: 'json' }, bytes: 5 },
      { result: { kind: 'unavailable', job: '4', reason: 'json' }, bytes: 0 },
    ]);
    // 既存の読み取りと同じ復号で、文字列の中の不正な UTF-8 は置換文字になる
    const replaced = fetchJob(root, '5');
    expect(replaced.result).toEqual({ kind: 'fetched', job: '5', value: { a: '\ufffd' } });
    expect(replaced.bytes).toBe(9);
    const empty = join(root, 'empty');
    mkdirSync(empty);
    vi.stubEnv('PATH', empty);
    expect(fetchJob(root, '1').result).toEqual({ kind: 'unavailable', job: '1', reason: 'missing' });
  }));
  it('[REQ-415] 起動の失敗とシグナルの終了を取得不能にし、native の受信の上限超えを出力の上限として投げる', () => {
    raw.mockReturnValueOnce({ status: null, signal: null, stdout: none, stderr: none, error: errno('EACCES') })
      .mockReturnValueOnce({ status: null, signal: 'SIGTERM', stdout: Buffer.from('{}'), stderr: none })
      .mockReturnValueOnce({ status: null, signal: null, stdout: none, stderr: none, error: errno('ENOBUFS') });
    expect([fetchJob(tmpdir(), '1').result, fetchJob(tmpdir(), '2').result]).toEqual([
      { kind: 'unavailable', job: '1', reason: 'spawn' }, { kind: 'unavailable', job: '2', reason: 'signal' },
    ]);
    expect(kindOf(thrown(() => fetchJob(tmpdir(), '3')))).toBe('output');
  });
  it('[REQ-415] 1 回の出力は 64MiB ちょうどまで受け付け、1 バイト超と呼出し側の小さい上限の超過を出力の上限として投げる', () => fixture((root, plan) => {
    plan({ 1: { pad: 64 * MiB - 2 }, 2: { pad: 64 * MiB - 1 }, 3: { stdout: '12' } });
    expect(fetchJob(root, '1')).toEqual({ result: { kind: 'fetched', job: '1', value: {} }, bytes: 64 * MiB });
    expect(kindOf(thrown(() => fetchJob(root, '2')))).toBe('output');
    expect(fetchJob(root, '3', 2).result).toEqual({ kind: 'fetched', job: '3', value: 12 });
    expect(kindOf(thrown(() => fetchJob(root, '3', 1)))).toBe('output');
    expect(fetchJob(root, '3', 128 * MiB).bytes).toBe(2);
    expect(raw.mock.calls.map((call) => call[2].maxBuffer)).toEqual([64 * MiB, 64 * MiB, 2, 1, 64 * MiB]);
  }));
  it('[REQ-415] 1 回の操作の期限と取得中の中断を取得不能にせず投げ、期限までの出力を既存の例外に残す', () => fixture((root, plan, calls) => {
    plan({ 1: { stdout: 'ab', stderr: 'c', wait: true } });
    const error = withProcessBudget({ timeoutMs: 30_000, maxOperationMs: 2_000 }, () => thrown(() => fetchJob(root, '1')));
    expect(error).toBeInstanceOf(ProcessLimitError);
    expect(error).toMatchObject({ kind: 'timeout', stdout: 'ab', stderr: 'c' });
    raw.mockImplementationOnce(() => { throw new ProcessLimitError('interrupted', 'gh'); });
    expect(kindOf(thrown(() => fetchJob(root, '2')))).toBe('interrupted');
    withProcessBudget({ timeoutMs: 1 }, () => {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
      expect(kindOf(thrown(() => fetchJob(root, '3')))).toBe('timeout');
    });
    expect(calls()).toHaveLength(1);
  }));
});
