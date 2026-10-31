import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { driveResultProcess } from '../scripts/claude-result-lifecycle.mjs';

const CAP = 2147483647;
class Stream extends EventEmitter {
  input = ''; destroyed = false;
  end(value: string) { this.input = value; }
  destroy() { this.destroyed = true; this.emit('error', new Error('private_marker')); }
}
function setup(limits: Record<string, number>) {
  const child = Object.assign(new EventEmitter(), { pid: 7243651, stdin: new Stream(), stdout: new Stream(), stderr: new Stream() });
  const parent = new EventEmitter(), pending = new Map<number, () => void>(), delays: number[] = [];
  let next = 0, spawns = 0, groups = 0;
  const promise = driveResultProcess({
    spawnChild: () => { spawns++; return child; },
    signalGroup: () => { groups++; return 'absent'; }, waitGroupExit: () => Promise.resolve(true), now: () => 0,
    timers: {
      setTimeout: (run: () => void, delay: number) => { const id = ++next; pending.set(id, run); delays.push(delay); return id; },
      clearTimeout: (id: number) => { pending.delete(id); },
    }, parentSignals: parent, platform: 'linux',
  }, {
    input: 'fixed synthetic input', limits,
    metadata: { cli: { version: '2.1.308', nativeSha256: 'f'.repeat(64) }, case: 'success', attempt: 1 },
  });
  // Even an old implementation that incorrectly starts must terminate in this fake test.
  child.stdout.emit('data', Buffer.from(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'OK' })));
  child.emit('exit', 0, null); child.emit('close', 0, null);
  return { promise, child, parent, pending, delays, spawns: () => spawns, groups: () => groups };
}
function cleared(h: ReturnType<typeof setup>) {
  expect(h.pending.size).toBe(0);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) expect(h.parent.listenerCount(signal)).toBe(0);
  expect(h.child.listenerCount('exit')).toBe(0); expect(h.child.listenerCount('close')).toBe(0);
  expect(h.child.stdout.listenerCount('data')).toBe(0); expect(h.child.stderr.listenerCount('data')).toBe(0);
}

// Injected clocks/emitters only: no real timer, spawn, signal, native or observation.
describe('lifecycleのtimer上限を起動前に検査する', () => {
  it.each(['stdout', 'stderr', 'timeoutMs', 'killAfterMs', 'groupWaitMs', 'closeGraceMs'])('%sがcapを1超えるとfactory0で拒否する', async (key) => {
    const h = setup({ [key]: CAP + 1 });
    expect(await h.promise).toMatchObject({ outcome: 'lifecycle-request-invalid', collected: false, transport: 'not-started', cleanup: 'not-started' });
    expect(h.spawns()).toBe(0); expect(h.groups()).toBe(0); expect(h.delays).toEqual([]); expect(h.child.stdin.input).toBe(''); cleared(h);
  });

  it.each([
    { killAfterMs: CAP - 1999, groupWaitMs: 1000, closeGraceMs: 1000 },
    { killAfterMs: CAP, groupWaitMs: CAP, closeGraceMs: CAP },
  ])('各値が範囲内でも後処理の合計超過ならfactory0', async (limits) => {
    const h = setup(limits);
    expect(await h.promise).toMatchObject({ outcome: 'lifecycle-request-invalid', collected: false });
    expect(h.spawns()).toBe(0); expect(h.groups()).toBe(0); expect(h.delays).toEqual([]); cleared(h);
  });

  it.each([
    { killAfterMs: CAP - 2000, groupWaitMs: 1000, closeGraceMs: 1000 },
    { killAfterMs: 1, groupWaitMs: CAP - 2, closeGraceMs: 1 },
    { killAfterMs: 1, groupWaitMs: 1, closeGraceMs: CAP - 2 },
  ])('後処理の合計がcapちょうどならfakeで受け付け長時間待たない', async (limits) => {
    const h = setup(limits);
    expect(await h.promise).toMatchObject({ outcome: 'case-matched', collected: false, cleanup: 'group-absent' });
    expect(h.spawns()).toBe(1); expect(h.groups()).toBe(1); expect(h.delays).toContain(CAP);
    expect(h.delays.every((delay) => delay <= CAP)).toBe(true); cleared(h);
  });

  it.each(['timeoutMs', 'stdout', 'stderr'])('%sのcap一致を受け付ける', async (key) => {
    const h = setup({ [key]: CAP });
    expect(await h.promise).toMatchObject({ outcome: 'case-matched', collected: false });
    expect(h.spawns()).toBe(1); expect(h.delays.every((delay) => delay <= CAP)).toBe(true); cleared(h);
  });
});
