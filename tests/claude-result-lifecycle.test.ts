import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { driveResultProcess } from '../scripts/claude-result-lifecycle.mjs';

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
class Clock {
  time = 0; next = 1; tasks = new Map<number, { at: number; run: () => void }>();
  now = () => this.time;
  setTimeout = (run: () => void, delay: number) => { const id = this.next++; this.tasks.set(id, { at: this.time + delay, run }); return id; };
  clearTimeout = (id: number) => { this.tasks.delete(id); };
  async advance(ms: number) {
    const target = this.time + ms;
    for (;;) {
      const next = [...this.tasks].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      this.time = next[1].at; this.tasks.delete(next[0]); next[1].run(); await flush();
    }
    this.time = target; await flush();
  }
  async fireEarly(id: number) { const task = this.tasks.get(id)!; this.tasks.delete(id); task.run(); await flush(); }
}
class Stream extends EventEmitter {
  destroyed = false; input = ''; throwOnEnd = false;
  end(value: string) { if (this.throwOnEnd) throw new Error('private_marker'); this.input = value; }
  destroy() { this.destroyed = true; this.emit('error', new Error('private_marker')); }
}
class Child extends EventEmitter {
  pid: number | undefined = 7243651; stdin = new Stream(); stdout = new Stream(); stderr = new Stream();
}
class Abort extends EventEmitter {
  aborted = false;
  addEventListener(name: string, fn: () => void) { this.on(name, fn); }
  removeEventListener(name: string, fn: () => void) { this.off(name, fn); }
  abort() { this.aborted = true; this.emit('abort'); }
}
type SignalStatus = 'sent' | 'absent' | 'failed';
type Options = {
  pid?: number; platform?: string; signal?: Abort; spawnThrow?: boolean; preSignal?: string;
  wait?: () => Promise<boolean>; send?: (pgid: number, signal: string) => SignalStatus;
  limits?: Record<string, number>; throwOnEnd?: boolean;
};
const metadata = () => ({ cli: { version: '2.1.308', nativeSha256: 'f'.repeat(64) }, case: 'success', attempt: 1 });
const raw = (extra = {}) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'OK', ...extra });
function setup(options: Options = {}) {
  const clock = new Clock(), child = new Child(), parent = new EventEmitter();
  if (Object.hasOwn(options, 'pid')) child.pid = options.pid;
  child.stdin.throwOnEnd = options.throwOnEnd ?? false;
  if (options.preSignal) {
    const on = parent.on.bind(parent);
    parent.on = (name, listener) => { on(name, listener); if (name === options.preSignal) listener(); return parent; };
  }
  let spawns = 0, spawnOptions: unknown;
  const signals: { pgid: number; signal: string; at: number }[] = [];
  const deps = {
    spawnChild: (value: unknown) => { spawns++; spawnOptions = value; if (options.spawnThrow) throw new Error('private_marker'); return child; },
    signalGroup: (pgid: number, signal: string): SignalStatus => { signals.push({ pgid, signal, at: clock.time }); return options.send?.(pgid, signal) ?? 'sent'; },
    waitGroupExit: () => options.wait?.() ?? Promise.resolve(true), now: clock.now,
    timers: { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout }, parentSignals: parent, platform: options.platform ?? 'linux',
  };
  const request = { input: 'fixed synthetic prompt', metadata: metadata(), signal: options.signal, limits: options.limits };
  const promise = driveResultProcess(deps, request);
  return { clock, child, parent, deps, request, promise, signals, spawns: () => spawns, spawnOptions: () => spawnOptions };
}
function output(h: ReturnType<typeof setup>, body = raw()) { h.child.stdout.emit('data', Buffer.from(body)); }
function exitClose(h: ReturnType<typeof setup>, code: number | null = 0, signal: string | null = null) { h.child.emit('exit', code, signal); h.child.emit('close', code, signal); }
function cleared(h: ReturnType<typeof setup>, signal?: Abort) {
  expect(h.clock.tasks.size).toBe(0);
  for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP']) expect(h.parent.listenerCount(name)).toBe(0);
  if (signal) expect(signal.listenerCount('abort')).toBe(0);
  for (const stream of [h.child.stdin, h.child.stdout, h.child.stderr]) {
    expect(stream.destroyed).toBe(true); expect(stream.listenerCount('data')).toBe(0); expect(stream.listenerCount('error')).toBe(1);
  }
  expect(h.child.listenerCount('exit')).toBe(0); expect(h.child.listenerCount('close')).toBe(0);
  expect(h.child.listenerCount('error')).toBe(1);
}

// Fake processes, clocks and emitters only. No real spawn, signal, runtime adapter or observation.
describe('lifecycleの開始と依存境界', () => {
  it('凍結した3pipe/shellなし/detachedをfake factoryだけへ渡す', async () => {
    const h = setup({ send: () => 'absent' }); output(h); exitClose(h); const r = await h.promise;
    expect(h.spawnOptions()).toEqual({ shell: false, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    expect(Object.isFrozen(h.spawnOptions())).toBe(true); expect(Object.isFrozen((h.spawnOptions() as { stdio: unknown }).stdio)).toBe(true);
    expect(h.child.stdin.input).toBe('fixed synthetic prompt'); expect(r).toMatchObject({ outcome: 'case-matched', collected: false }); cleared(h);
  });
  it.each(['SIGINT', 'SIGTERM', 'SIGHUP'])('開始前の親%sはfactory0', async (name) => {
    const h = setup({ preSignal: name }); expect(await h.promise).toMatchObject({ outcome: 'interrupted', flags: { aborted: true } }); expect(h.spawns()).toBe(0); expect(h.signals).toHaveLength(0); expect(h.clock.tasks.size).toBe(0);
  });
  it('開始前abortはfactory0でlistenerを回収する', async () => {
    const signal = new Abort(); signal.abort(); const h = setup({ signal });
    expect(await h.promise).toMatchObject({ outcome: 'interrupted' }); expect(h.spawns()).toBe(0); expect(signal.listenerCount('abort')).toBe(0);
  });
  it('win32はfactory0で拒否する', async () => {
    const h = setup({ platform: 'win32' }); expect(await h.promise).toMatchObject({ outcome: 'lifecycle-platform-unsupported' }); expect(h.spawns()).toBe(0); expect(h.signals).toHaveLength(0);
  });
  it.each(['spawnChild', 'signalGroup', 'waitGroupExit', 'now', 'timers', 'parentSignals'])('必須依存%sの欠落は追加factory0', async (key) => {
    const h = setup({ platform: 'win32' }); await h.promise;
    expect(await driveResultProcess({ ...h.deps, [key]: undefined }, h.request)).toMatchObject({ outcome: 'lifecycle-dependency-missing' }); expect(h.spawns()).toBe(0);
  });
  it('factoryの秘密入りthrowを固定理由にする', async () => {
    const h = setup({ spawnThrow: true }); const r = await h.promise;
    expect(r).toMatchObject({ outcome: 'spawn-failed', transport: 'not-started', cleanup: 'not-started' }); expect(h.signals).toHaveLength(0); expect(JSON.stringify(r)).not.toContain('private_marker');
  });
  it('destroy契約のないpipeはowned実行として受けない', async () => {
    const h = setup({ platform: 'win32' }); await h.promise;
    Object.assign(h.child.stdout, { destroy: undefined }); h.deps.platform = 'linux';
    expect(await driveResultProcess(h.deps, h.request)).toMatchObject({ outcome: 'spawn-failed' }); expect(h.signals).toHaveLength(0);
  });
  it.each([undefined, 0, 1, -1, process.pid])('不正または自分のpid=%sへsignalを送らない', async (pid) => {
    const h = setup({ pid }); expect(await h.promise).toMatchObject({ outcome: 'spawn-failed' }); expect(h.signals).toHaveLength(0); cleared(h);
  });
});

describe('owned groupの有界cleanupと元結果', () => {
  it.each([0, 1])('正常/非ゼロexit%dとflagsをcleanupで書き換えない', async (code) => {
    const h = setup(); output(h); exitClose(h, code); await h.clock.advance(4999); expect(h.signals.map((s) => s.signal)).toEqual(['SIGTERM']);
    await h.clock.advance(1); const r = await h.promise;
    expect(r).toMatchObject({ outcome: code === 0 ? 'case-matched' : 'nonzero-exit', exit: { code, signal: null }, close: { code, signal: null }, primary: null, cleanup: 'group-exited', transport: 'closed', flags: { timedOut: false, aborted: false, stdoutLimitHit: false } });
    expect(h.signals).toEqual([{ pgid: h.child.pid, signal: 'SIGTERM', at: 0 }, { pgid: h.child.pid, signal: 'SIGKILL', at: 5000 }]); cleared(h);
  });
  it.each(['false', 'reject', 'never'])('waitの%sでもdriverが有界に終わる', async (kind) => {
    const h = setup({ wait: () => kind === 'false' ? Promise.resolve(false) : kind === 'reject' ? Promise.reject(new Error('private_marker')) : new Promise<boolean>(() => {}) });
    output(h); exitClose(h); await h.clock.advance(7000); const r = await h.promise;
    expect(r).toMatchObject({ outcome: 'cleanup-unproved', exit: { code: 0 }, flags: { timedOut: false }, cleanup: 'cleanup-unproved' }); expect(JSON.stringify(r)).not.toContain('private_marker'); cleared(h);
  });
  it.each(['failed', 'throw'])('signalの%sを後のtrueで解消しない', async (kind) => {
    const h = setup({ send: () => { if (kind === 'throw') throw new Error('private_marker'); return 'failed'; } }); output(h); exitClose(h); await h.clock.advance(7000);
    expect(await h.promise).toMatchObject({ outcome: 'cleanup-unproved', exit: { code: 0 } }); cleared(h);
  });
  it('自発的signal終了もtimeoutへ書き換えない', async () => {
    const h = setup(); output(h); exitClose(h, null, 'SIGTERM'); await h.clock.advance(7000);
    expect(await h.promise).toMatchObject({ outcome: 'nonzero-exit', exit: { code: null, signal: 'SIGTERM' }, flags: { timedOut: false, aborted: false } }); cleared(h);
  });
  it('absentはKILLせずgroup-absentにする', async () => {
    const h = setup({ send: () => 'absent' }); output(h); exitClose(h); expect(await h.promise).toMatchObject({ outcome: 'case-matched', cleanup: 'group-absent' }); expect(h.signals.map((s) => s.signal)).toEqual(['SIGTERM']); cleared(h);
  });
  it('deadlineと同時に届いたgroup trueを採用しない', async () => {
    let answer!: (value: boolean) => void;
    const h = setup({ wait: () => new Promise<boolean>((resolve) => { answer = resolve; }) }); output(h); exitClose(h); await h.clock.advance(5000);
    h.clock.time = 6000; answer(true); await flush(); expect(await h.promise).toMatchObject({ outcome: 'cleanup-unproved', flags: { timedOut: false } }); cleared(h);
  });
});

describe('transportの故障と一度だけの終結', () => {
  it('exit後closeなしは猶予内でclose-timeout', async () => {
    const h = setup(); output(h); h.child.emit('exit', 0, null); await h.clock.advance(7000);
    expect(await h.promise).toMatchObject({ outcome: 'close-timeout', exit: { code: 0 }, close: null, transport: 'close-timeout', flags: { timedOut: false } }); cleared(h);
  });
  it('closeだけならexitを作らない', async () => {
    const h = setup(); output(h); h.child.emit('close', 0, null); await h.clock.advance(7000);
    expect(await h.promise).toMatchObject({ outcome: 'exit-unobserved', exit: null, close: { code: 0 } }); cleared(h);
  });
  it('exit/close不一致を固定理由で拒否する', async () => {
    const h = setup(); output(h); h.child.emit('exit', 0, null); h.child.emit('close', 1, null); await h.clock.advance(7000);
    expect(await h.promise).toMatchObject({ outcome: 'exit-close-mismatch', exit: { code: 0 }, close: { code: 1 } }); cleared(h);
  });
  it('不正signal payloadを元exitや返却値へ混入しない', async () => {
    const h = setup({ send: () => 'absent' }); h.child.emit('exit', 0, 'private_marker'); h.child.emit('close', 0, 'private_marker'); await h.clock.advance(7000); const r = await h.promise;
    expect(r).toMatchObject({ outcome: 'lifecycle-event-invalid', exit: null, close: null }); expect(JSON.stringify(r)).not.toContain('private_marker'); cleared(h);
  });
  it.each(['stdin', 'stdout', 'stderr', 'child'])('%s errorとclose未到達を固定理由にして終える', async (name) => {
    const h = setup({ wait: () => new Promise<boolean>(() => {}) });
    const target = name === 'child' ? h.child : h.child[name as 'stdin' | 'stdout' | 'stderr'];
    target.emit('error', new Error('private_marker')); await h.clock.advance(7000); const r = await h.promise;
    expect(r).toMatchObject({ outcome: `${name}-error`, collected: false, cleanup: 'cleanup-unproved', transport: 'close-timeout' }); expect(JSON.stringify(r)).not.toContain('private_marker'); cleared(h);
  });
  it('stdin.endの同期throwも本文を出さない', async () => {
    const h = setup({ throwOnEnd: true }); await h.clock.advance(7000); expect(await h.promise).toMatchObject({ outcome: 'stdin-error' }); cleared(h);
  });
  it.each(['SIGINT', 'SIGTERM', 'SIGHUP'])('親%sと重複中断はowned groupだけを一度止める', async (name) => {
    const h = setup(); h.parent.emit(name); h.parent.emit(name); exitClose(h, 0); await h.clock.advance(7000);
    expect(await h.promise).toMatchObject({ outcome: 'interrupted', exit: { code: 0 }, flags: { aborted: true, timedOut: false } }); expect(h.signals).toHaveLength(2); cleared(h);
  });
  it('exit後abortでも元exitを保持する', async () => {
    const signal = new Abort(); const h = setup({ signal }); output(h); exitClose(h); signal.abort(); await h.clock.advance(7000);
    expect(await h.promise).toMatchObject({ outcome: 'interrupted', exit: { code: 0 }, flags: { aborted: true, timedOut: false } }); cleared(h, signal);
  });
  it.each(['stdout', 'stderr'])('%s上限を元exitやcleanupと混同しない', async (name) => {
    const h = setup({ limits: { stdout: 8, stderr: 8 } }); h.child[name as 'stdout' | 'stderr'].emit('data', Buffer.from('private_marker')); exitClose(h); await h.clock.advance(7000);
    expect(await h.promise).toMatchObject({ outcome: `${name}-limit`, exit: { code: 0 }, flags: { timedOut: false, stdoutLimitHit: name === 'stdout', stderrLimitHit: name === 'stderr' } }); cleared(h);
  });
  it('早いtimerを再待機し5分の期限と同時中断の主因を保持する', async () => {
    const h = setup(); const timer = [...h.clock.tasks.keys()][0]; await h.clock.fireEarly(timer);
    await h.clock.advance(299999); expect(h.signals).toHaveLength(0); await h.clock.advance(1); h.parent.emit('SIGTERM'); exitClose(h, null, 'SIGTERM'); await h.clock.advance(7000);
    expect(await h.promise).toMatchObject({ outcome: 'timeout', primary: 'timeout', exit: { code: null, signal: 'SIGTERM' }, flags: { timedOut: true, aborted: true } }); cleared(h);
  });
  it('正常cleanup後の遅いerror/closeが結果を変えずmessageを漏らさない', async () => {
    const h = setup({ send: () => 'absent' }); output(h, raw({ result: 'private_marker', ignored: 'private_marker' })); h.child.stderr.emit('data', Buffer.from('private_marker')); exitClose(h); const r = await h.promise; const before = JSON.stringify(r);
    for (const target of [h.child.stdin, h.child.stdout, h.child.stderr, h.child]) expect(() => target.emit('error', new Error('private_marker'))).not.toThrow();
    h.child.emit('close', 1, null); expect(JSON.stringify(r)).toBe(before); expect(before).not.toContain('private_marker'); expect(before).not.toContain(String(h.child.pid)); expect(r).toMatchObject({ outcome: 'case-matched', collected: false, fixture: { provenance: 'derived' } }); cleared(h);
  });
  it.each([false, true])('UTF8分割と不正末尾を区別する truncated=%s', async (truncated) => {
    const h = setup({ send: () => 'absent' }); const bytes = Buffer.from(raw({ ignored: '日本語' })); const index = bytes.indexOf(Buffer.from('日'));
    if (truncated) h.child.stdout.emit('data', Buffer.from([0xff]));
    else { h.child.stdout.emit('data', bytes.subarray(0, index + 1)); h.child.stdout.emit('data', bytes.subarray(index + 1)); }
    exitClose(h); expect(await h.promise).toMatchObject({ outcome: truncated ? 'invalid-utf8' : 'case-matched', collected: false }); cleared(h);
  });
});
