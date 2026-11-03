import { AsyncLocalStorage } from 'node:async_hooks';
import { BODY_EVIDENCE_KEY, type BodyAttempt, type BodyEvidence } from '@loomake/core';
type Method = (this: unknown, ...args: unknown[]) => unknown;
export type ChaiLike = {
  Assertion: { prototype: object }; util: {
    flag(value: unknown, key: string): unknown;
    overwriteMethod(prototype: object, name: string, factory: (original: Method) => Method): void;
  };
};
export type BodyContext = {
  task: { meta: object; fails?: boolean; result?: { repeatCount?: number; retryCount?: number; state?: string } };
  onTestFinished(callback: () => void): void;
};
type Entry = BodyAttempt & { scopes: Scope[] };
type Scope = { task: BodyContext['task']; entry: Entry; open: boolean };
const scopes = new AsyncLocalStorage<Scope>();
const installed = new WeakSet();
const records = new WeakMap<object, Map<string, Entry>>();
const incomplete = new WeakSet();
export function createBodyRecorder(chai: ChaiLike) {
  if (!installed.has(chai.Assertion.prototype)) {
    installed.add(chai.Assertion.prototype);
    for (const name of ['toBe', 'toEqual', 'toMatchObject']) chai.util.overwriteMethod(chai.Assertion.prototype, name, original => function (...args) {
      const scope = scopes.getStore();
      if (scope?.open) try {
        const shape = [chai.util.flag(this, 'promise'), chai.util.flag(this, 'soft') ? 'soft' : null, chai.util.flag(this, '_poll.fn') ? 'poll' : null, chai.util.flag(this, 'negate') ? 'not' : null, name].filter(Boolean).join('.');
        scope.entry.calls[shape] = (scope.entry.calls[shape] ?? 0) + 1;
      } catch { incomplete.add(scope.entry); }
      return original.apply(this, args);
    });
  }
  return function body<T>(ctx: BodyContext | null | undefined, fn: () => T | Promise<T>): T | Promise<T> {
    let task: BodyContext['task'] | undefined, finished: BodyContext['onTestFinished'] | undefined;
    try { task = ctx?.task; finished = ctx?.onTestFinished.bind(ctx); } catch { return fn(); }
    if (!task || typeof finished !== 'function') return fn();
    const nested = scopes.getStore();
    if (nested?.open && nested.task === task) return fn();
    let scope: Scope;
    try {
      const meta = task.meta as Record<string, unknown>;
      const repeat = task.result?.repeatCount ?? 0, retry = task.result?.retryCount ?? 0, key = `${repeat}:${retry}`;
      let map = records.get(task);
      if (!map) { map = new Map(); records.set(task, map); meta[BODY_EVIDENCE_KEY] = { format: 1, attempts: [] }; }
      let entry = map.get(key);
      if (!entry) {
        entry = { repeat, retry, expectedFailure: task.fails ?? null, state: null, calls: {} } as Entry;
        map.set(key, entry);
        (meta[BODY_EVIDENCE_KEY] as BodyEvidence).attempts.push(entry);
        const observed = entry;
        finished(() => { try {
          if (!incomplete.has(observed)) observed.state = task.result?.state ?? null;
          for (const open of observed.scopes) open.open = false;
        } catch { /* 記録の失敗で利用側の結果を変えない。 */ } });
        Object.defineProperty(entry, 'scopes', { value: [], enumerable: false });
      }
      scope = { task, entry, open: true };
      entry.scopes.push(scope);
    } catch { return fn(); }
    return scopes.run(scope, async () => { try { return await fn(); } finally { scope.open = false; } });
  };
}
