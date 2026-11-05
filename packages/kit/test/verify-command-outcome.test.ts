import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { runVerify, type QualityCommandOutcome, type VerifyOptions } from '@loomake/kit';
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
