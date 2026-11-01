import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runExternal, withProcessBudget, ProcessLimitError } from '@loomake/kit';
import * as runtime from '../../kit/src/runtime/process.js';
import { observeRunExternal, observeSpawnSync } from './process-diagnostics.js';
import { classifyCall } from '../../../scripts/external-call-diagnostics.mjs';

vi.mock('node:child_process', async (original) => {
  const cp = await original<typeof import('node:child_process')>();
  const diagnostics = await import('./process-diagnostics.js');
  return { ...cp, spawnSync: diagnostics.observeSpawnSync(cp) };
});
vi.mock('../../kit/src/runtime/process.js', async (original) => {
  const real = await original<typeof import('../../kit/src/runtime/process.js')>();
  const diagnostics = await import('./process-diagnostics.js');
  return { ...real, runExternal: diagnostics.observeRunExternal(real) };
});

const directories: string[] = [];
function directory() { const dir = mkdtempSync(join(tmpdir(), 'loomake-call-diagnostics-')); directories.push(dir); return dir; }
function records(dir: string): Record<string, unknown>[] {
  return readdirSync(dir).filter((f) => f.startsWith('calls.')).flatMap((f) => readFileSync(join(dir, f), 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)));
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('外部操作の試験用観測', () => {
  it.each([false, true])('観測設定%sでも引数・返値・throwを同じまま一度だけ通す', (enabled) => {
    const dir = directory(); if (enabled) vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', dir);
    else vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', '');
    const args = ['pr', 'list']; const options = { env: { SECRET: 'private-output' }, cwd: '/private-path' };
    const value = { status: 0, signal: null, stdout: 'private-output', stderr: '' } as const;
    const calls: unknown[][] = [];
    const real = { ...runtime, runExternal: (...input: Parameters<typeof runExternal>) => { calls.push(input); return value; } };
    expect(observeRunExternal(real)('gh', args, options)).toBe(value);
    expect(calls).toHaveLength(1); expect(calls[0]).toEqual(['gh', args, options]);
    expect(calls[0][1]).toBe(args); expect(calls[0][2]).toBe(options);
    const error = new ProcessLimitError('timeout', 'private-message');
    expect(() => observeRunExternal({ ...real, runExternal: () => { throw error; } })('gh', args, options)).toThrow(error);
    try { observeRunExternal({ ...real, runExternal: () => { throw error; } })('gh', args, options); }
    catch (actual) { expect(actual).toBe(error); }
    if (!enabled) expect(readdirSync(dir)).toEqual([]);
    else {
      expect(records(dir)).toHaveLength(3);
      const text = readdirSync(dir).map((f) => readFileSync(join(dir, f), 'utf8')).join('');
      expect(text).not.toMatch(/private-output|private-path|private-message|SECRET/);
    }
  });

  it('spawnの引数・返値を同一に通し、supervisor以外の生出力を記録しない', () => {
    const dir = directory(); vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', dir);
    const args = ['-e', 'private-payload']; const options = { env: { SECRET: 'private' } };
    const value = { pid: 1, status: 0, signal: null, output: [null, Buffer.from('private'), null], stdout: Buffer.from('private'), stderr: Buffer.alloc(0) };
    const calls: unknown[][] = [];
    const fn = ((...a: unknown[]) => { calls.push(a); return value; }) as typeof import('node:child_process').spawnSync;
    const cp = { spawnSync: fn };
    expect(observeSpawnSync(cp)('node', args, options)).toBe(value);
    expect(calls).toEqual([['node', args, options]]); expect(calls[0][1]).toBe(args); expect(calls[0][2]).toBe(options);
    expect(records(dir)).toEqual([]);
  });

  it('観測時計を読めなくても元spawnの返値を維持する', () => {
    const dir = directory(); vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', dir);
    const value = { pid: 1, status: 0, signal: null, output: [null, null, null], stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
    let calls = 0;
    const fn = (() => { calls++; return value; }) as unknown as typeof import('node:child_process').spawnSync;
    vi.spyOn(process.hrtime, 'bigint').mockImplementation(() => { throw new Error('diagnostic clock unavailable'); });
    const result = observeSpawnSync({ spawnSync: fn })(process.execPath, ['supervisor.cjs', '[]']);
    expect(result).toBe(value); expect(calls).toBe(1);
    expect(records(dir)[0]).toMatchObject({ event: 'spawn', spawn: { ts: null, te: null } });
  });

  it('保存先が使えなくても元の返値と例外を変えない', () => {
    const dir = directory(); const file = join(dir, 'not-directory'); writeFileSync(file, 'x');
    vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', file);
    const value = { status: 0, signal: null, stdout: '', stderr: '' } as const;
    expect(observeRunExternal({ ...runtime, runExternal: () => value })('gh', [])).toBe(value);
    const error = new Error('original');
    try { observeRunExternal({ ...runtime, runExternal: () => { throw error; } })('gh', []); }
    catch (actual) { expect(actual).toBe(error); }
    expect(readFileSync(file, 'utf8')).toBe('x');
  });

  it('64KiBに完全JSONLと上限印を収め、その後は増やさない', () => {
    const dir = directory(); vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', dir);
    const value = { status: 0, signal: null, stdout: '', stderr: '' } as const;
    const fn = observeRunExternal({ ...runtime, runExternal: () => value });
    for (let i = 0; i < 1000; i++) fn('gh', ['pr', 'list']);
    const files = readdirSync(dir); expect(files).toHaveLength(1);
    const file = join(dir, files[0]); const size = statSync(file).size;
    expect(size).toBeLessThanOrEqual(64 * 1024); expect(records(dir).at(-1)).toMatchObject({ event: 'truncated' });
    fn('gh', []); expect(statSync(file).size).toBe(size);
  });

  it('barrel経由の本物runExternalとsupervisorへ届き、期限とfd3のkindを同じcallへ結ぶ', () => {
    const dir = directory(); vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', dir);
    expect(() => withProcessBudget({ timeoutMs: 5000, maxOperationMs: 500 }, () => runExternal(process.execPath, ['-e', 'setInterval(() => {}, 1000)']))).toThrow(ProcessLimitError);
    const row = records(dir).find((r) => r.event === 'call')!;
    expect(row).toMatchObject({ spawned: true, result: 'threw', limitKind: 'timeout', internalTimeoutMs: null, spawn: { outcomeKind: 'timeout', invalid: false } });
    const interval = row.timeoutIntervalMs as number[]; expect(interval[0]).toBeLessThanOrEqual(500); expect(interval[1]).toBeGreaterThanOrEqual(500);
    expect(classifyCall(row)).toMatchObject({ classification: 'operation-limit' });
  }, 15_000);

  it('共有期限の実停止と起動前の予算切れを区別する', () => {
    const dir = directory(); vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', dir);
    expect(() => withProcessBudget({ timeoutMs: 600 }, () => runExternal(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { untilDeadline: true }))).toThrow(ProcessLimitError);
    expect(classifyCall(records(dir).find((r) => r.event === 'call')!)).toMatchObject({ classification: 'shared-deadline' });
    expect(classifyCall(records(dir).find((r) => r.event === 'call')!)).toHaveProperty('coincidentOperationPossible', false);
    withProcessBudget({ timeoutMs: 1 }, () => {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
      expect(() => runExternal(process.execPath, ['-e', ''])).toThrow(ProcessLimitError);
    });
    expect(records(dir).at(-1)).toMatchObject({ spawned: false, spawn: null, limitKind: 'timeout', Rclamped: true });
    expect(classifyCall(records(dir).at(-1)!)).toMatchObject({ classification: 'pre-spawn-timeout' });
  }, 15_000);
});


describe('明示timeoutの副作用を増やさない観測', () => {
  it.each([
    [{ timeoutMs: 1 }, true], [{}, false], [undefined, false],
  ] as const)('plain options %jの有無だけを記録し返値と引数を保持する', (options, timeoutRequested) => {
    const dir = directory(); vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', dir);
    const args = ['pr', 'list']; const value = { status: 0, signal: null, stdout: '', stderr: '' } as const;
    const calls: unknown[][] = [];
    const real = { ...runtime, runExternal: (...input: Parameters<typeof runExternal>) => { calls.push(input); return value; } };
    expect(observeRunExternal(real)('gh', args, options)).toBe(value);
    expect(calls).toHaveLength(1); expect(calls[0][1]).toBe(args); expect(calls[0][2]).toBe(options);
    expect(records(dir)[0]).toMatchObject({ timeoutRequested, internalTimeoutMs: null });
  });
  it.each(['accessor', 'inherited', 'proxy'] as const)('%sではtimeoutを追加評価せずunknownとし、元getter回数と例外を保持する', (kind) => {
    const dir = directory(); vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', dir);
    let reads = 0; let reflectionTraps = 0;
    const accessor = { get timeoutMs() { reads++; return 1; } };
    const options = kind === 'accessor' ? accessor : kind === 'inherited' ? Object.create(accessor) : new Proxy(accessor, {
      getOwnPropertyDescriptor(target, key) { reflectionTraps++; return Reflect.getOwnPropertyDescriptor(target, key); },
      getPrototypeOf(target) { reflectionTraps++; return Reflect.getPrototypeOf(target); },
    });
    const args = ['pr', 'list']; const value = { status: 0, signal: null, stdout: '', stderr: '' } as const;
    const calls: unknown[][] = [];
    const real = { ...runtime, runExternal: (...input: Parameters<typeof runExternal>) => { calls.push(input); void input[2]?.timeoutMs; return value; } };
    expect(observeRunExternal(real)('gh', args, options)).toBe(value);
    expect(reads).toBe(1); expect(reflectionTraps).toBe(0);
    expect(calls).toHaveLength(1); expect(calls[0][1]).toBe(args); expect(calls[0][2]).toBe(options);
    expect(records(dir)[0]).toMatchObject({ timeoutRequested: null });
    const error = new ProcessLimitError('timeout', 'original');
    let caught: unknown;
    try { observeRunExternal({ ...real, runExternal: (...input: Parameters<typeof runExternal>) => { void input[2]?.timeoutMs; throw error; } })('gh', args, options); }
    catch (actual) { caught = actual; }
    expect(caught).toBe(error); expect(reads).toBe(2); expect(reflectionTraps).toBe(0);
    expect(records(dir).at(-1)).toMatchObject({ timeoutRequested: null });
  });
  it('own dataのnullはtimeout指定なしとして記録する', () => {
    const dir = directory(); vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', dir);
    const options = { timeoutMs: null } as unknown as Parameters<typeof runExternal>[2];
    const value = { status: 0, signal: null, stdout: '', stderr: '' } as const;
    expect(observeRunExternal({ ...runtime, runExternal: () => value })('gh', [], options)).toBe(value);
    expect(records(dir)[0]).toMatchObject({ timeoutRequested: false });
  });
});

// REQ-350 の追加契約。上の既存試験は変更せず、元関数の評価と観測の評価を分ける。
describe('REQ-350 元関数前の不活性な観測', () => {
  const value = { status: 0, signal: null, stdout: '', stderr: '' } as const;

  it('[REQ-350] 選択中に自身を変えるtimeout getterを再評価せずunknownで保持する', () => {
    const dir = directory(); vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', dir);
    let reads = 0;
    const options = { get timeoutMs() { reads++; Object.defineProperty(this, 'timeoutMs', { value: null, configurable: true }); return 1; } };
    const args = ['pr', 'list']; const inputs: unknown[][] = []; let selected: number | undefined;
    const original = (...input: Parameters<typeof runExternal>) => { inputs.push(input); selected = input[2]?.timeoutMs; return value; };
    expect(observeRunExternal({ ...runtime, runExternal: original })('gh', args, options)).toBe(value);
    expect(selected).toBe(1); expect(reads).toBe(1); expect(inputs).toHaveLength(1);
    expect(inputs[0][1]).toBe(args); expect(inputs[0][2]).toBe(options);
    expect(records(dir)[0]).toMatchObject({ timeoutRequested: null, mode: 'normal' });
  });

  it('[REQ-350] 選択後のdata変更より前のtimeoutとmodeとcwdを保持する', () => {
    const dir = directory(); vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', dir);
    const options = { timeoutMs: 1, qualityCommand: false, untilDeadline: true, cwd: join(tmpdir(), 'loomake-run-snapshot', 'project') };
    let selected: number | undefined; let calls = 0;
    const original = (...input: Parameters<typeof runExternal>) => {
      calls++; selected = input[2]?.timeoutMs; options.timeoutMs = null as unknown as number;
      options.qualityCommand = true; options.untilDeadline = false; options.cwd = 'private-path'; return value;
    };
    expect(observeRunExternal({ ...runtime, runExternal: original })('gh', [], options)).toBe(value);
    expect(selected).toBe(1); expect(calls).toBe(1);
    expect(records(dir)[0]).toMatchObject({ timeoutRequested: true, mode: 'untilDeadline', repo: 'loomake-run-snapshot' });
  });

  it('[REQ-350] 先行qualityCommand getterがtimeoutを変えても追加評価せず両方をunknownにする', () => {
    const dir = directory(); vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', dir);
    let reads = 0; let selected: number | null | undefined;
    const options = { timeoutMs: null as number | null, get qualityCommand() { reads++; this.timeoutMs = 1; return false; } };
    const original = (...input: Parameters<typeof runExternal>) => {
      const config = input[2]; void (config?.qualityCommand || config?.untilDeadline); selected = config?.timeoutMs; return value;
    };
    expect(observeRunExternal({ ...runtime, runExternal: original })('gh', [], options as Parameters<typeof runExternal>[2])).toBe(value);
    expect(reads).toBe(1); expect(selected).toBe(1);
    expect(records(dir)[0]).toMatchObject({ timeoutRequested: null, mode: null });
  });

  it.each([
    [{ timeoutMs: 1 }, true], [{}, false], [undefined, false], [{ timeoutMs: null }, false],
  ] as const)('[REQ-350] 固定plain設定%jを三値とnormalへ投影する', (options, timeoutRequested) => {
    const dir = directory(); vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', dir);
    let calls = 0;
    const original = (...input: Parameters<typeof runExternal>) => { calls++; expect(input[2]).toBe(options); return value; };
    expect(observeRunExternal({ ...runtime, runExternal: original })('gh', [], options as Parameters<typeof runExternal>[2])).toBe(value);
    expect(calls).toBe(1); expect(records(dir)[0]).toMatchObject({ timeoutRequested, mode: 'normal' });
  });

  it.each(['accessor', 'inherited', 'proxy'] as const)('[REQ-350] %sの全追加評価を避け、同じ返値と元ProcessLimitErrorを保持する', (kind) => {
    const dir = directory(); vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', dir);
    let reads = 0; let cwdReads = 0;
    const traps: Record<string, number> = {};
    const target = { get timeoutMs() { reads++; return 1; }, get cwd() { cwdReads++; return 'private-cwd'; } };
    const handler = Object.fromEntries(['apply', 'construct', 'defineProperty', 'deleteProperty', 'get', 'getOwnPropertyDescriptor', 'getPrototypeOf', 'has', 'isExtensible', 'ownKeys', 'preventExtensions', 'set', 'setPrototypeOf'].map((key) => [key, (...args: unknown[]) => {
      traps[key] = (traps[key] ?? 0) + 1;
      return (Reflect[key as keyof typeof Reflect] as (...args: unknown[]) => unknown)(...args);
    }])) as ProxyHandler<typeof target>;
    const options = kind === 'accessor' ? target : kind === 'inherited' ? Object.create(target) : new Proxy(target, handler);
    const args = ['pr', 'list']; let calls = 0;
    const original = (...input: Parameters<typeof runExternal>) => { calls++; expect(input[1]).toBe(args); expect(input[2]).toBe(options); void input[2]?.timeoutMs; return value; };
    expect(observeRunExternal({ ...runtime, runExternal: original })('gh', args, options)).toBe(value);
    expect(calls).toBe(1); expect(reads).toBe(1); expect(cwdReads).toBe(0);
    expect(traps).toEqual(kind === 'proxy' ? { get: 1 } : {});
    expect(records(dir)[0]).toMatchObject({ timeoutRequested: null }); expect(records(dir)[0]).not.toHaveProperty('repo');
    const error = new ProcessLimitError('timeout', 'private-message'); let caught: unknown;
    try { observeRunExternal({ ...runtime, runExternal: (...input: Parameters<typeof runExternal>) => { original(...input); throw error; } })('gh', args, options); }
    catch (actual) { caught = actual; }
    expect(caught).toBe(error); expect(calls).toBe(2); expect(reads).toBe(2); expect(cwdReads).toBe(0);
    expect(traps).toEqual(kind === 'proxy' ? { get: 2 } : {});
    expect(records(dir).at(-1)).toMatchObject({ timeoutRequested: null }); expect(records(dir).at(-1)).not.toHaveProperty('repo');
  });

  it('[REQ-350] 診断envなしではProxy設定を検査せず記録しない', () => {
    const dir = directory(); vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', '');
    let traps = 0; let calls = 0;
    const handler = Object.fromEntries(['apply', 'construct', 'defineProperty', 'deleteProperty', 'get', 'getOwnPropertyDescriptor', 'getPrototypeOf', 'has', 'isExtensible', 'ownKeys', 'preventExtensions', 'set', 'setPrototypeOf'].map((key) => [key, () => { traps++; throw new Error(key); }])) as ProxyHandler<object>;
    const options = new Proxy({}, handler); const args = ['pr', 'list'];
    const original = (...input: Parameters<typeof runExternal>) => { calls++; expect(input[1]).toBe(args); expect(input[2]).toBe(options); return value; };
    expect(observeRunExternal({ ...runtime, runExternal: original })('gh', args, options)).toBe(value);
    expect(calls).toBe(1); expect(traps).toBe(0); expect(readdirSync(dir)).toEqual([]);
  });

  it('[REQ-350] snapshotを診断env確認直後かつ予算時計の観測前に取る', () => {
    const dir = directory(); vi.stubEnv('LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR', dir);
    const options = { timeoutMs: 1 };
    const real = { ...runtime, remainingProcessTime: () => { options.timeoutMs = null as unknown as number; return 5000; }, runExternal: () => value };
    expect(observeRunExternal(real)('gh', [], options)).toBe(value);
    expect(records(dir)[0]).toMatchObject({ timeoutRequested: true, mode: 'normal' });
  });
});
