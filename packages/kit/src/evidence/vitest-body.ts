import { AsyncLocalStorage } from 'node:async_hooks';
import { BODY_EVIDENCE_KEY, type BodyAttempt, type BodyEvidence } from '@loomake/core';
import { readBodyAttempt, readMethod, type AttemptToken } from './vitest-attempt.js';
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
type Entry = { evidence: BodyAttempt; scopes: Set<Scope>; closed: boolean; incomplete: boolean };
type Ledger = { evidence: BodyEvidence; entries: WeakMap<AttemptToken, Entry> };
type Scope = { task: BodyContext['task']; token: AttemptToken; entry: Entry; open: boolean };
const scopes = new AsyncLocalStorage<Scope | undefined>();
const installed = new WeakSet();
const records = new WeakMap<object, Ledger>();
const closedTokens = new WeakSet<AttemptToken>();

function closeEntry(token: AttemptToken, entry: Entry): void {
  // Closure is independent of writable public evidence or foreign token properties.
  closedTokens.add(token);
  entry.closed = true;
  for (const scope of entry.scopes) scope.open = false;
  entry.scopes.clear();
  try { token.close(); } catch { /* A foreign token cannot replace the callback result. */ }
}

export function createBodyRecorder(chai: ChaiLike) {
  if (!installed.has(chai.Assertion.prototype)) {
    installed.add(chai.Assertion.prototype);
    for (const name of ['toBe', 'toEqual', 'toMatchObject']) chai.util.overwriteMethod(chai.Assertion.prototype, name, original => function (...args) {
      const scope = scopes.getStore();
      if (scope) try {
        if (scope.open && !scope.entry.closed && !closedTokens.has(scope.token) && scope.token.open) {
          const shape = [chai.util.flag(this, 'promise'), chai.util.flag(this, 'soft') ? 'soft' : null, chai.util.flag(this, '_poll.fn') ? 'poll' : null, chai.util.flag(this, 'negate') ? 'not' : null, name].filter(Boolean).join('.');
          scope.entry.evidence.calls[shape] = (scope.entry.evidence.calls[shape] ?? 0) + 1;
        }
      } catch { scope.entry.incomplete = true; }
      return original.apply(this, args);
    });
  }
  return function body<T>(ctx: BodyContext | null | undefined, fn: () => T | Promise<T>): T | Promise<T> {
    let scope: Scope | undefined, reuseScope = false;
    try {
      const task = ctx?.task;
      const token = task && readBodyAttempt(task);
      // Validate the originating attempt before touching mutable metadata or counters.
      if (task && token && !closedTokens.has(token)) {
        const nested = scopes.getStore();
        reuseScope = !!nested?.open && !nested.entry.closed && nested.task === task && nested.token === token;
        if (!reuseScope) {
          const finished = readMethod(ctx, 'onTestFinished');
          if (typeof finished === 'function') {
            let ledger = records.get(task);
            if (!ledger) {
              const evidence: BodyEvidence = { format: 1, attempts: [] };
              (task.meta as Record<string, unknown>)[BODY_EVIDENCE_KEY] = evidence;
              ledger = { evidence, entries: new WeakMap() };
              records.set(task, ledger);
            }
            let entry = ledger.entries.get(token);
            if (!entry) {
              entry = {
                evidence: { repeat: token.repeat, retry: token.retry, expectedFailure: task.fails ?? null, state: null, calls: {} },
                scopes: new Set(), closed: false, incomplete: false,
              };
              ledger.entries.set(token, entry);
              ledger.evidence.attempts.push(entry.evidence);
              const observed = entry;
              try {
                finished.call(ctx, () => {
                  try {
                    if (!observed.closed && !observed.incomplete) observed.evidence.state = task.result?.state ?? null;
                  } catch { /* Snapshot failure leaves state null or the existing evidence unchanged. */ }
                  finally { closeEntry(token, observed); }
                });
              } catch { closeEntry(token, observed); }
            }
            if (!entry.closed && !closedTokens.has(token) && token.open) {
              scope = { task, token, entry, open: true };
              entry.scopes.add(scope);
            }
          }
        }
      }
    } catch { /* Recording preparation must never execute or repeat the caller's callback. */ }
    if (!scope) return reuseScope ? fn() : scopes.run(undefined, fn);
    const active = scope;
    return scopes.run(active, async () => {
      try { return await fn(); }
      finally { active.open = false; active.entry.scopes.delete(active); }
    });
  };
}
