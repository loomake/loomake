import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { realpathSync } from 'node:fs';
import { formatVerifyResult, runVerify, UsageError, verifyExitCode, type QualityCommandOutcome, type VerifyOptions } from '@loomake/kit';
import * as runtime from '../src/runtime/process.js';
import type { ExternalResult } from '../src/runtime/process.js';
import { CHANGE, withProject } from './project.js';

const { command } = vi.hoisted(() => ({ command: vi.fn<(name: string) => ExternalResult>() }));
vi.mock('node:child_process', async original => {
  const actual = await original<typeof import('node:child_process')>();
  return { ...actual, spawnSync: (name: string, ...args: unknown[]) => name.startsWith('quality-')
    ? command(name) : Reflect.apply(actual.spawnSync, actual, [name, ...args]) };
});

const result = (values: Partial<ExternalResult> = {}): ExternalResult => ({ status: 0, signal: null, stdout: '', stderr: '', ...values });
const config = (commands: Record<string, string> = { lint: 'quality-lint', test: 'quality-test' }) => ({ openspecValidate: false, commands });
const run = (root: string, onCommand?: VerifyOptions['onCommand'], options: Partial<VerifyOptions> = {}) => runVerify({ root, onCommand, ...options });

beforeEach(() => {
  command.mockReset().mockImplementation(() => result());
  vi.spyOn(runtime, 'hasProcessBudget').mockReturnValue(false);
  vi.spyOn(runtime, 'holderWaitTime').mockReturnValue(0);
});
afterEach(() => vi.restoreAllMocks());

it('[REQ-455] notifies every configured command once in the existing order without extra execution', () => withProject({
  config: config({ audit: 'quality-audit', test: 'quality-test', typecheck: 'quality-types', lint: 'quality-lint' }),
}, root => {
  command.mockImplementation(name => result({ status: name === 'quality-test' ? 1 : 0 }));
  const outcomes: QualityCommandOutcome[] = [];
  run(root, value => outcomes.push(value));
  expect(command.mock.calls.map(([name]) => name)).toEqual(['quality-lint', 'quality-types', 'quality-test', 'quality-audit']);
  expect(outcomes).toEqual([
    { name: 'lint', kind: 'exited', status: 0 }, { name: 'typecheck', kind: 'exited', status: 0 },
    { name: 'test', kind: 'exited', status: 1 }, { name: 'audit', kind: 'exited', status: 0 },
  ]);
}));

type WithoutName<T> = T extends unknown ? Omit<T, 'name'> : never;
const endings: [string, ExternalResult, WithoutName<QualityCommandOutcome>][] = [
  ['nonzero', result({ status: 1 }), { kind: 'exited', status: 1 }],
  ['signal', result({ status: null, signal: 'SIGTERM' }), { kind: 'signal', signal: 'SIGTERM' }],
  ['spawn error', result({ status: null, error: Object.assign(new Error('spawn'), { code: 'ENOENT' }) }), { kind: 'error', code: 'ENOENT' }],
  ['unknown error code', result({ status: null, error: new Error('spawn') }), { kind: 'error', code: null }],
  ['error precedes status', result({ error: Object.assign(new Error('output'), { code: 'ENOBUFS' }) }), { kind: 'error', code: 'ENOBUFS' }],
  ['missing completion', result({ status: null }), { kind: 'error', code: null }],
];
it.each(endings)('[REQ-455] exposes the raw %s without assuming completion', (_label, raw, expected) => withProject({ config: config({ test: 'quality-test' }) }, root => {
  command.mockReturnValue(raw);
  const notify = vi.fn();
  run(root, notify);
  expect(notify.mock.calls).toEqual([[{ name: 'test', ...expected }]]);
  expect(command).toHaveBeenCalledTimes(1);
}));

it.each(['timeout', 'interrupted', 'output'] as const)('[REQ-455] notifies a process %s and leaves unvisited commands unnotified', kind => withProject({ config: config() }, root => {
  vi.spyOn(runtime, 'runExternal').mockImplementation(() => { throw new runtime.ProcessLimitError(kind, 'quality-lint', '', '', 'supervisor'); });
  const notify = vi.fn();
  run(root, notify, { timeoutMs: 1000 });
  expect(notify.mock.calls).toEqual([[{ name: 'lint', kind, reason: 'supervisor' }]]);
  expect(runtime.runExternal).toHaveBeenCalledTimes(1);
  expect(command).not.toHaveBeenCalled();
}));

it('[REQ-455] notifies a reasonless limit and continues under the existing shared budget', () => withProject({ config: config() }, root => {
  vi.mocked(runtime.hasProcessBudget).mockReturnValue(true);
  vi.spyOn(runtime, 'runExternal').mockImplementation(() => { throw new runtime.ProcessLimitError('timeout', 'quality'); });
  const notify = vi.fn();
  run(root, notify);
  expect(notify.mock.calls).toEqual([[{ name: 'lint', kind: 'timeout' }], [{ name: 'test', kind: 'timeout' }]]);
  expect(runtime.runExternal).toHaveBeenCalledTimes(2);
}));

it('[REQ-455] notifies visited commands rejected before launch by the existing total deadline', () => withProject({ config: config() }, root => {
  const notify = vi.fn();
  run(root, notify, { timeoutMs: 0 });
  expect(notify.mock.calls).toEqual([[{ name: 'lint', kind: 'timeout' }], [{ name: 'test', kind: 'timeout' }]]);
  expect(command).not.toHaveBeenCalled();
}));

it.each(['skip', 'empty', 'spec-only'] as const)('[REQ-455] does not notify %s commands or unrelated specification operations', mode => withProject({
  config: mode === 'empty' ? config({}) : config(),
}, root => {
  const notify = vi.fn();
  run(root, notify, mode === 'skip' ? { skipCommands: true } : mode === 'spec-only' ? { changeId: CHANGE, gate: 'spec-only' } : {});
  expect(notify).not.toHaveBeenCalled();
  expect(command).not.toHaveBeenCalled();
}));

it('[REQ-455] uses the same notifications with a change in the done gate', () => withProject({ config: config() }, root => {
  const notify = vi.fn();
  run(root, notify, { changeId: CHANGE, gate: 'done', scope: 'local' });
  expect(notify.mock.calls).toEqual([[{ name: 'lint', kind: 'exited', status: 0 }], [{ name: 'test', kind: 'exited', status: 0 }]]);
  expect(command).toHaveBeenCalledTimes(2);
}));

it('[REQ-455][REQ-456] observes real shell exits without changing the command failure', () => withProject({
  config: config({ lint: 'node -e "process.exit(0)"', test: 'node -e "process.exit(1)"' }),
}, root => {
  const outcomes: QualityCommandOutcome[] = [];
  const verified = run(root, event => outcomes.push(event));
  expect(outcomes).toEqual([{ name: 'lint', kind: 'exited', status: 0 }, { name: 'test', kind: 'exited', status: 1 }]);
  expect(verifyExitCode(verified)).toBe(1);
  expect(command).not.toHaveBeenCalled();
}));

const compatible: [string, ExternalResult][] = [['success', result()], ...endings.map(([name, raw]): [string, ExternalResult] => [name, raw])];
it.each(compatible)('[REQ-456][REQ-042] preserves the entire result, JSON, text and exit for %s', (_name, raw) => withProject({ config: config() }, root => {
  command.mockReturnValue(raw);
  const without = run(root), calls = command.mock.calls.map(([name]) => name);
  command.mockClear();
  const notify = vi.fn(), withNotification = run(root, notify);
  expect(withNotification).toEqual(without);
  expect(JSON.stringify(withNotification)).toBe(JSON.stringify(without));
  expect(formatVerifyResult(withNotification)).toBe(formatVerifyResult(without));
  expect(verifyExitCode(withNotification)).toBe(verifyExitCode(without));
  expect(command.mock.calls.map(([name]) => name)).toEqual(calls);
  expect(notify).toHaveBeenCalledTimes(2);
}));

it.each(endings.filter(([name]) => ['nonzero', 'signal', 'spawn error'].includes(name)))('[REQ-456][REQ-042] matches the full pre-change completion probe for %s', (_name, raw) => withProject({ config: config({ test: 'quality-test' }) }, root => {
  command.mockReturnValue(raw);
  expect(run(root, () => {})).toEqual({
    schemaVersion: '2.0.0', change: null, run: { status: 'completed', errors: [] },
    checks: [{ id: 'command: test', result: 'FAIL', reason: '', evidence: [] }],
    decision: { required: false, reasons: [] }, scope: 'local',
    summary: { fail: 1, insufficient: 0, not_applicable: 0, evaluated: 1, pending: 0 },
  });
}));

it.each(['timeout', 'interrupted', 'output'] as const)('[REQ-456] preserves existing %s results and early return with or without notification', kind => withProject({ config: config() }, root => {
  vi.spyOn(runtime, 'runExternal').mockImplementation(() => { throw new runtime.ProcessLimitError(kind, 'quality', '', '', 'supervisor'); });
  const without = run(root, undefined, { timeoutMs: 1000 });
  const calls = vi.mocked(runtime.runExternal).mock.calls.slice();
  vi.mocked(runtime.runExternal).mockClear();
  const notified = run(root, () => {}, { timeoutMs: 1000 });
  expect(notified).toEqual(without);
  expect(JSON.stringify(notified)).toBe(JSON.stringify(without));
  expect(verifyExitCode(notified)).toBe(verifyExitCode(without));
  // Both executions use the same explicit time budget; the clock is checked separately below.
  expect(runtime.runExternal).toHaveBeenCalledTimes(calls.length);
}));

it('[REQ-456] retains the existing deadline and shared-budget execution options', () => withProject({ config: config() }, root => {
  const external = vi.spyOn(runtime, 'runExternal').mockImplementation(() => result());
  const clock = vi.spyOn(Date, 'now');
  const execute = (notify?: VerifyOptions['onCommand']) => {
    clock.mockReturnValueOnce(1000).mockReturnValueOnce(1200).mockReturnValueOnce(1400);
    external.mockClear();
    const verified = run(root, notify, { timeoutMs: 1000 });
    return { verified, calls: external.mock.calls.slice() };
  };
  const without = execute(), notified = execute(() => {});
  expect(notified).toEqual(without);
  expect(notified.calls.map(([, , options]) => options)).toEqual([
    { cwd: realpathSync(root), shell: true, timeoutMs: 800, qualityCommand: true, maxBuffer: 64 * 1024 * 1024 },
    { cwd: realpathSync(root), shell: true, timeoutMs: 600, qualityCommand: true, maxBuffer: 64 * 1024 * 1024 },
  ]);
  clock.mockRestore();
  vi.mocked(runtime.hasProcessBudget).mockReturnValue(true);
  external.mockClear();
  run(root, () => {});
  expect(external.mock.calls.map(([, , options]) => options?.timeoutMs)).toEqual([undefined, undefined]);
  expect(command).not.toHaveBeenCalled();
}));

it('[REQ-456] preserves visited deadline failures with and without notification', () => withProject({ config: config() }, root => {
  const without = run(root, undefined, { timeoutMs: 0 });
  expect(run(root, () => {}, { timeoutMs: 0 })).toEqual(without);
  expect(command).not.toHaveBeenCalled();
}));

it.each(['ordinary', 'limit'] as const)('[REQ-456] propagates the identical callback %s exception at every notification site', kind => withProject({ config: config() }, root => {
  const thrown = kind === 'ordinary' ? new Error('callback') : new runtime.ProcessLimitError('interrupted', 'callback');
  for (const site of ['exited', 'limit', 'deadline'] as const) {
    command.mockClear();
    vi.mocked(runtime.hasProcessBudget).mockReturnValue(site === 'limit');
    const external = vi.spyOn(runtime, 'runExternal').mockImplementation(() => { throw new runtime.ProcessLimitError('timeout', 'quality'); });
    const notify = vi.fn(() => { throw thrown; });
    let caught: unknown;
    try { run(root, notify, site === 'deadline' ? { timeoutMs: 0 } : {}); } catch (error) { caught = error; }
    expect(caught).toBe(thrown);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledTimes(site === 'exited' ? 1 : 0);
    expect(external).toHaveBeenCalledTimes(site === 'limit' ? 1 : 0);
    external.mockRestore();
  }
}));

it('[REQ-456] isolates callback mutation from the original result and later events', () => withProject({ config: config() }, root => {
  command.mockImplementation(name => result({ status: name === 'quality-lint' ? 1 : 0 }));
  const without = run(root), events: QualityCommandOutcome[] = [], seen: QualityCommandOutcome[] = [];
  const notified = run(root, event => {
    events.push(event); seen.push({ ...event });
    Object.assign(event, { name: 'changed', kind: 'exited', status: 99 });
  });
  expect(notified).toEqual(without);
  expect(seen).toEqual([{ name: 'lint', kind: 'exited', status: 1 }, { name: 'test', kind: 'exited', status: 0 }]);
  expect(events[0]).not.toBe(events[1]);
}));

it('[REQ-456] preserves progress and non-limit execution exceptions without notifications', () => withProject({ config: config() }, root => {
  const notify = vi.fn(), progressError = new Error('progress'), executionError = new UsageError('execution');
  let caught: unknown;
  try { run(root, notify, { progress: () => { throw progressError; } }); } catch (error) { caught = error; }
  expect(caught).toBe(progressError); expect(command).not.toHaveBeenCalled();
  command.mockImplementation(() => { throw executionError; });
  try { run(root, notify); } catch (error) { caught = error; }
  expect(caught).toBe(executionError); expect(notify).not.toHaveBeenCalled();
}));
