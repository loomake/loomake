import { AsyncLocalStorage } from 'node:async_hooks';
import { expect, it } from 'vitest';
import type { BodyEvidence } from '@loomake/core';
import { createBodyRecorder, type ChaiLike } from '../src/evidence/vitest-body.js';
import { installAttemptReader, newAttempt, type AttemptToken } from '../src/evidence/vitest-attempt.js';

function harness() {
  const finished: (() => void)[] = [];
  const task = { meta: {} as { loomakeBody?: BodyEvidence }, result: { repeatCount: 0, retryCount: 0, state: 'pass' } };
  const context = { task, onTestFinished(callback: () => void) { finished.push(callback); } };
  Object.defineProperty(task, 'context', { value: context, configurable: true });
  const channel = new AsyncLocalStorage<AttemptToken | undefined>();
  installAttemptReader(context, channel);
  const token = newAttempt(task)!;
  let matcherCalls = 0, flagFailure = false, matcherError: unknown;
  const originalResult = {};
  class Assertion {
    toBe() { matcherCalls++; if (matcherError) throw matcherError; return originalResult; }
    toEqual() { return this.toBe(); }
    toMatchObject() { return this.toBe(); }
  }
  const chai: ChaiLike = { Assertion, util: {
    flag() { if (flagFailure) throw new Error('flag read failed'); return undefined; },
    overwriteMethod(prototype, name, factory) {
      Object.defineProperty(prototype, name, { value: factory(Reflect.get(prototype, name) as (this: unknown, ...args: unknown[]) => unknown), configurable: true });
    },
  } };
  const body = createBodyRecorder(chai), assertion = new Assertion();
  return { task, context, channel, token, finished, body, chai, assertion, originalResult,
    get matcherCalls() { return matcherCalls; },
    failFlags() { flagFailure = true; }, failMatcher(error: unknown) { matcherError = error; },
  };
}

it('[REQ-393] missing, invalid and closed tokens run callbacks once before mutable metadata or counter reads', async () => {
  const h = harness(), original = new Error('callback error');
  let reads = 0, callbacks = 0;
  Object.defineProperty(h.task, 'meta', { get() { reads++; throw new Error('metadata must not be read'); } });
  Object.defineProperty(h.task, 'result', { get() { reads++; throw new Error('counters must not be read'); } });
  h.token.close();
  const invalid = { ...h.token, open: true, retry: -1 };
  for (const token of [undefined, h.token, invalid, { ...invalid, task: {} }]) {
    let seen: unknown;
    try { void h.channel.run(token, () => h.body(h.context, () => { callbacks++; throw original; })); }
    catch (error) { seen = error; }
    expect(seen).toBe(original);
  }
  expect(callbacks).toBe(4); expect(reads).toBe(0); expect(h.finished).toHaveLength(0);
  expect(await h.channel.run(undefined, () => h.body(h.context, async () => { callbacks++; await Promise.resolve(); return 8; }))).toBe(8);
  expect(callbacks).toBe(5);
});

it('[REQ-393] an open foreign-task token alone runs callbacks once without evidence or mutable task reads', async () => {
  const h = harness(), meta = h.task.meta, original = new Error('foreign-task callback error');
  const foreign = newAttempt({ result: { repeatCount: 0, retryCount: 0 } })!;
  expect(foreign).toMatchObject({ version: 1, repeat: 0, retry: 0, open: true });
  expect(foreign).not.toBe(h.token); expect(foreign.task).not.toBe(h.task);
  let reads = 0, callbacks = 0;
  Object.defineProperty(h.task, 'meta', { get() { reads++; throw new Error('metadata must not be read'); } });
  Object.defineProperty(h.task, 'result', { get() { reads++; throw new Error('counters must not be read'); } });
  expect(h.channel.run(foreign, () => h.body(h.context, () => { callbacks++; return h.assertion.toBe(); }))).toBe(h.originalResult);
  expect(callbacks).toBe(1);
  let seen: unknown;
  try { void h.channel.run(foreign, () => h.body(h.context, () => { callbacks++; throw original; })); }
  catch (error) { seen = error; }
  expect(seen).toBe(original); expect(callbacks).toBe(2);
  expect(await h.channel.run(foreign, () => h.body(h.context, async () => {
    callbacks++; await Promise.resolve(); return h.assertion.toBe();
  }))).toBe(h.originalResult);
  expect(callbacks).toBe(3);
  await expect(h.channel.run(foreign, () => h.body(h.context, async () => {
    callbacks++; await Promise.resolve(); throw original;
  }))).rejects.toBe(original);
  expect(callbacks).toBe(4); expect(h.matcherCalls).toBe(2);
  expect(reads).toBe(0); expect(meta.loomakeBody).toBeUndefined(); expect(h.finished).toHaveLength(0);
  expect(foreign.open).toBe(true);
});

it('[REQ-393] ledger uses token identity, retains history and original counters, and factories never double count', async () => {
  const h = harness(), secondBody = createBodyRecorder(h.chai);
  Object.defineProperty(h.task, 'result', { get() { throw new Error('mutable counters unreadable'); } });
  await h.channel.run(h.token, () => h.body(h.context, async () => {
    await secondBody(h.context, () => h.assertion.toBe());
    await Promise.all([h.body(h.context, () => h.assertion.toBe()), secondBody(h.context, () => h.assertion.toBe())]);
    const nextToken = { ...h.token, retry: 1, close() {} };
    await h.channel.run(nextToken, () => h.body(h.context, () => h.assertion.toBe()));
  }));
  await h.channel.run(h.token, () => h.body(h.context, () => h.assertion.toBe()));
  // Identical counters are still separate attempts when the runner supplies a new identity.
  await h.channel.run({ ...h.token, close() {} }, () => h.body(h.context, () => h.assertion.toBe()));
  expect(h.task.meta.loomakeBody).toEqual({ format: 1, attempts: [
    { repeat: 0, retry: 0, expectedFailure: null, state: null, calls: { toBe: 4 } },
    { repeat: 0, retry: 1, expectedFailure: null, state: null, calls: { toBe: 1 } },
    { repeat: 0, retry: 0, expectedFailure: null, state: null, calls: { toBe: 1 } },
  ] });
  expect(h.finished).toHaveLength(3); expect(h.matcherCalls).toBe(6);
});

it('[REQ-393] finished closes every scope and entry even with frozen evidence and a throwing token close', async () => {
  const h = harness(); let releases: (() => void)[] = [], closeCalls = 0;
  const token = Object.freeze({ ...h.token, open: true, close() { closeCalls++; throw new Error('token close failed'); } });
  const pending = [1, 2].map(() => Promise.resolve(h.channel.run(token, () => h.body(h.context, async () => {
    await new Promise<void>(resolve => { releases.push(resolve); });
    return h.assertion.toBe();
  }))));
  const entry = h.task.meta.loomakeBody!.attempts[0];
  Object.freeze(entry);
  Object.freeze(h.task.meta.loomakeBody);
  h.finished[0]();
  releases.forEach(release => release()); releases = [];
  expect(await Promise.all(pending)).toEqual([h.originalResult, h.originalResult]);
  let callbacks = 0;
  expect(await h.channel.run(token, () => h.body(h.context, () => { callbacks++; return h.assertion.toBe(); }))).toBe(h.originalResult);
  expect(callbacks).toBe(1); expect(h.matcherCalls).toBe(3); expect(entry.calls).toEqual({});
  expect(h.task.meta.loomakeBody!.attempts).toHaveLength(1); expect(h.finished).toHaveLength(1); expect(closeCalls).toBe(1);
});

it('[REQ-393] token getter and flag failures preserve the original matcher result, error and single invocation', async () => {
  for (const failure of ['token', 'flag', 'write']) {
    const h = harness(), original = new Error('original matcher');
    let broken = false, callbacks = 0;
    const token = { ...h.token, get open() { if (broken) throw new Error('token getter failed'); return true; } };
    h.failMatcher(original);
    let seen: unknown;
    try { await h.channel.run(token, () => h.body(h.context, () => {
      callbacks++;
      if (failure === 'token') broken = true;
      if (failure === 'flag') h.failFlags();
      if (failure === 'write') Object.freeze(h.task.meta.loomakeBody!.attempts[0].calls);
      return h.assertion.toBe();
    })); } catch (error) { seen = error; }
    expect(seen).toBe(original); expect(callbacks).toBe(1); expect(h.matcherCalls).toBe(1);
    h.finished[0]();
    expect(h.task.meta.loomakeBody!.attempts[0]).toMatchObject({ state: null, calls: {} });
  }
});


it('[REQ-393] an invalid nested call cannot add evidence to the enclosing attempt', async () => {
  const h = harness(); let callbacks = 0;
  await h.channel.run(h.token, () => h.body(h.context, async () => {
    h.assertion.toBe();
    await h.channel.run(undefined, () => h.body(h.context, async () => {
      callbacks++; await Promise.resolve(); return h.assertion.toBe();
    }));
    h.assertion.toBe();
  }));
  expect(callbacks).toBe(1); expect(h.matcherCalls).toBe(3);
  expect(h.task.meta.loomakeBody!.attempts[0].calls).toEqual({ toBe: 2 });
});

it('[REQ-393] matcher results and callback errors survive recording preparation failure without a second execution', async () => {
  for (const failure of ['metadata', 'registration', 'reader']) {
    const h = harness(), original = new Error('callback rejection');
    let callbacks = 0;
    if (failure === 'metadata') Object.freeze(h.task.meta);
    if (failure === 'registration') h.context.onTestFinished = () => { throw new Error('registration failed'); };
    if (failure === 'reader') Object.defineProperty(h.task, 'context', { value: new Proxy({}, { get() { throw new Error('reader lookup failed'); } }) });
    let seen: unknown;
    try { await h.channel.run(h.token, () => h.body(h.context, async () => {
      callbacks++; await Promise.resolve();
      expect(h.assertion.toBe()).toBe(h.originalResult);
      throw original;
    })); } catch (error) { seen = error; }
    expect(seen).toBe(original); expect(callbacks).toBe(1); expect(h.matcherCalls).toBe(1);
    expect(h.task.meta.loomakeBody?.attempts[0]?.calls ?? {}).toEqual({});
  }
});
