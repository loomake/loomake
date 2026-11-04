import { chai, expect, it } from 'vitest';
import { createBodyRecorder, createBodyRunner, type BodyContext } from '@loomake/kit';
import type { BodyEvidence } from '@loomake/core';

it('[REQ-393] unconfigured legacy consumers preserve callbacks without new evidence', async () => {
  const body = createBodyRecorder(chai);
  let registrations = 0;
  const context = {
    task: { meta: {}, fails: false, result: { repeatCount: 0, retryCount: 0, state: 'pass' } },
    onTestFinished() { registrations++; },
  };
  // A complete old-style context has counters and a finished hook, but no runner reader.
  Object.assign(context.task, { context });
  const value = { original: true };
  let calls = 0;
  expect(body(context, () => { calls++; expect(1).toBe(1); return value; })).toBe(value);
  const error = new Error('original');
  expect(() => body(context, () => { calls++; throw error; })).toThrow(error);
  let caught: unknown;
  try { await body(context, () => { calls++; throw error; }); } catch (seen) { caught = seen; }
  expect(caught).toBe(error);
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  let completed = false;
  const pending = body(context, async () => { calls++; await waiting; completed = true; return value; });
  expect(completed).toBe(false);
  release();
  expect(await pending).toBe(value);
  expect(completed).toBe(true);
  await expect(body(context, async () => { calls++; await Promise.resolve(); throw error; })).rejects.toBe(error);
  expect(calls).toBe(5);
  expect(registrations).toBe(0);
  expect(context.task.meta).not.toHaveProperty('loomakeBody');
});

it('[REQ-393] public runner setup migrates fake contexts without losing counts or callback results', async () => {
  const body = createBodyRecorder(chai);
  class ExistingRunner {
    extendTaskContext(context: BodyContext): BodyContext { return context; }
    runTask(task: { invoke: () => unknown }): unknown { return task.invoke(); }
  }
  const Runner = createBodyRunner(ExistingRunner);
  const runner = new Runner();
  const value = { original: true }, error = new Error('original');
  for (const mode of ['value', 'throw', 'resolve', 'reject']) {
    let calls = 0;
    const hooks: (() => void)[] = [];
    const task = {
      meta: {} as { loomakeBody?: BodyEvidence }, fails: false,
      result: { repeatCount: 0, retryCount: 0, state: ['throw', 'reject'].includes(mode) ? 'fail' : 'pass' },
      invoke: (): unknown => body(context, () => {
        calls++; expect(1).toBe(1);
        if (mode === 'throw') throw error;
        if (mode === 'reject') return Promise.resolve().then(() => { throw error; });
        return mode === 'resolve' ? Promise.resolve(value) : value;
      }),
    };
    const context = { task, onTestFinished(callback: () => void) { hooks.push(callback); } };
    Object.assign(task, { context });
    expect(runner.extendTaskContext(context)).toBe(context);
    let result: unknown, caught: unknown;
    try { result = await runner.runTask(task); } catch (seen) { caught = seen; }
    for (const finished of hooks) finished();
    expect(calls).toBe(1);
    expect(caught).toBe(['throw', 'reject'].includes(mode) ? error : undefined);
    expect(result).toBe(['throw', 'reject'].includes(mode) ? undefined : value);
    expect(task.meta.loomakeBody?.attempts).toEqual([{ repeat: 0, retry: 0, expectedFailure: false, state: task.result.state, calls: { toBe: 1 } }]);
  }
});
