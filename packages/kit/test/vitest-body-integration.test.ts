import { expect, it } from 'vitest';
import { runBodyIntegration, type IntegrationEvent } from './body-integration.js';
type Run = ReturnType<typeof runBodyIntegration>;
function paired(plain: Run, product: Run) {
  for (const run of [plain, product]) {
    expect(run.error, run.raw).toBeNull(); expect(run.signal, run.raw).toBeNull();
    expect(run.cases[0].length, run.stdout + run.stderr).toBeGreaterThan(0);
    expect(run.stderr).not.toContain('FixtureParseError');
    for (const event of run.events.filter(event => event.fnCalls !== undefined)) expect(event.fnCalls, run.raw).toBe(1);
  }
  expect(product.status, product.raw).toBe(plain.status);
  expect(product.cases.map(cases => cases.map(test => [test.fullName, test.status])))
    .toEqual(plain.cases.map(cases => cases.map(test => [test.fullName, test.status])));
}
function events(run: Run, label: string, kind: string) {
  return run.events.filter(event => event.label === label && event.kind === kind);
}
function event(run: Run, label: string, kind: string, invocation = 0): IntegrationEvent {
  const matches = events(run, label, kind).filter(event => event.invocation === invocation &&
    (label !== 'Base' || event.caseName?.includes('[K01]')));
  expect(matches, `${run.raw} ${label}/${kind}/${invocation}`).toHaveLength(1);
  return matches[0];
}
function evidence(run: Run, label: string) {
  const matches = run.cases[0].filter(test => test.fullName.includes(`[${label}]`));
  expect(matches).toHaveLength(1);
  return matches[0].meta.loomakeBody;
}

for (const isolate of [undefined, false]) {
  it(`[REQ-393] late callbacks and legal awaits preserve origin with isolate=${String(isolate ?? 'default')}`, { timeout: 60_000 }, () => {
    const plain = runBodyIntegration({ mode: 'identity', fixture: 'late-cases', isolate });
    const product = runBodyIntegration({ mode: 'product', fixture: 'late-cases', isolate });
    paired(plain, product); expect(product.status).toBe(1);
    expect(product.cases[0]).toHaveLength(18);
    for (const label of ['R01', 'R02', 'R03', 'R04', 'C01']) {
      expect(product.cases[0].find(test => test.fullName.includes(`[${label}]`))?.status).toBe('passed');
      expect(event(product, label, 'finished').state).toBe('fail');
      expect(event(product, label, 'callback-start', 1).retry).toBe(1);
    }
    for (const label of ['R01', 'R02', 'R03', 'R04', 'N01']) {
      const before = event(product, label, 'late-before'), after = event(product, label, 'late-after');
      expect(after.evidence).toEqual(before.evidence);
      expect(after.fnCalls).toBe(1); expect(before.token).toMatchObject({ retry: 0, open: false });
      expect(evidence(product, label)?.attempts.map(attempt => attempt.calls) ?? []).toEqual(
        label === 'R02' ? [{}, {}] : label === 'R03' ? [] : [{}]);
      if (label !== 'N01') {
        expect(before.retry).toBe(1); expect(before.activeTokenOpen).toBe(true);
        expect(event(product, label, 'callback-start', 1).token?.id).not.toBe(before.token?.id);
      }
    }
    expect(evidence(product, 'R01')?.attempts.map(attempt => attempt.retry)).toEqual([1]);
    expect(evidence(product, 'R02')?.attempts.map(attempt => attempt.retry)).toEqual([0, 1]);
    expect(evidence(product, 'R03')).toBeUndefined();
    expect(evidence(product, 'R04')?.attempts.map(attempt => attempt.retry)).toEqual([0]);
    expect(event(product, 'N01', 'finished').evidence).toEqual(event(product, 'N01', 'late-after').evidence);
    expect(evidence(product, 'N01')).toEqual(event(product, 'N01', 'late-after').evidence);
    expect(event(product, 'C01', 'before-late-matcher').evidence).toEqual(event(product, 'C01', 'after-late-matcher').evidence);
    expect(event(product, 'C01', 'before-late-matcher').token).toMatchObject({ retry: 0, open: false });
    expect(event(product, 'C01', 'before-late-matcher').activeTokenOpen).toBe(true);
    expect(event(product, 'C01', 'before-late-matcher').retry).toBe(1);
    expect(events(product, 'C01', 'body-after')).toHaveLength(2);
    expect(evidence(product, 'C01')?.attempts.map(attempt => [attempt.retry, attempt.calls])).toEqual([[0, {}], [1, {}]]);
    for (const [label, calls] of [['A02', 1], ['A03', 2], ['A04', 2], ['A07a', 1], ['A07b', 1], ['A08', 1], ['D01', 1]] as const) {
      expect(evidence(product, label)?.attempts.map(attempt => attempt.calls)).toEqual([{ toBe: calls }]);
    }
    expect(event(product, 'A04', 'branch-two-before').evidence).toBeNull();
    expect(event(product, 'A04', 'branch-two-after').evidence?.attempts[0].calls).toEqual({ toBe: 1 });
    expect(event(product, 'A04', 'branch-one-before').evidence?.attempts[0].calls).toEqual({ toBe: 1 });
    expect(event(product, 'A04', 'branch-one-after').evidence?.attempts[0].calls).toEqual({ toBe: 2 });
    expect(evidence(product, 'A05')?.attempts.map(attempt => [attempt.retry, attempt.calls])).toEqual([[0, { toBe: 1 }], [1, { toBe: 1 }]]);
    expect(evidence(product, 'A06')?.attempts.map(attempt => [attempt.repeat, attempt.calls])).toEqual(
      [[0, { toBe: 1 }], [1, { toBe: 1 }], [2, { toBe: 1 }]]);
    expect(event(product, 'A07a', 'callback-start').token?.id).not.toBe(event(product, 'A07b', 'callback-start').token?.id);
    for (const run of [plain, product]) {
      expect(events(run, 'D01', 'fn-enter')).toHaveLength(1); expect(events(run, 'D01', 'nested-fn-enter')).toHaveLength(1);
      for (const [label, count] of [['R01', 2], ['R02', 3], ['R03', 1], ['R04', 2], ['N01', 2], ['C01', 2]] as const) {
        expect(run.events.filter(event => event.label === label && event.fnCalls !== undefined)).toHaveLength(count);
      }
    }
  });
}

for (const aroundEach of [false, true]) {
  it(`[REQ-393] automatic fixture preserves the same host aroundEach=${String(aroundEach)} timing boundary`, { timeout: 60_000 }, () => {
    const plain = runBodyIntegration({ mode: 'identity', fixture: 'auto-cases', aroundEach });
    const product = runBodyIntegration({ mode: 'product', fixture: 'auto-cases', aroundEach });
    paired(plain, product); expect(product.status).toBe(aroundEach ? 0 : 1);
    expect(product.cases[0]).toHaveLength(2);
    for (const run of [plain, product]) {
      expect(run.autoEvents.filter(kind => kind === 'auto-fixture-setup-start')).toHaveLength(1);
      expect(run.autoEvents.filter(kind => kind === 'auto-fixture-setup-done')).toHaveLength(1);
      expect(run.autoEvents.filter(kind => kind === 'test-body')).toHaveLength(1);
      expect(run.autoEvents.filter(kind => kind === 'body-fn')).toHaveLength(1);
      expect(run.autoEvents.indexOf('auto-fixture-setup-done')).toBeLessThan(run.autoEvents.indexOf('test-body'));
      expect(run.autoEvents.at(-1)).toBe('after-all');
    }
    expect(!!evidence(product, 'AF01')).toBe(aroundEach);
  });
}

for (const custom of ['prototype', 'own'] as const) {
  it(`[REQ-393] custom Base ${custom} cleanup keeps its original token until delegation ends`, { timeout: 60_000 }, () => {
    const plain = runBodyIntegration({ mode: 'identity', fixture: 'cleanup-cases', custom });
    const product = runBodyIntegration({ mode: 'product', fixture: 'cleanup-cases', custom });
    paired(plain, product); expect(product.status).toBe(0);
    for (const run of [plain, product]) {
      expect(events(run, 'Base', 'context')).toHaveLength(2);
      for (const kind of ['delegate-start', 'wrapper-settled', 'delegate-ending', 'delegate-settled']) expect(events(run, 'Base', kind)).toHaveLength(3);
      expect(events(run, 'K01', 'callback-start')).toHaveLength(2);
      expect(event(run, 'K01', 'cleanup-first-after').fnCalls).toBe(1);
      expect(event(run, 'K01', 'after-delegation-after').fnCalls).toBe(1);
      expect(event(run, 'K01', 'retry-after', 1).fnCalls).toBe(1);
    }
    const original = event(product, 'K01', 'callback-start').token;
    const during = event(product, 'K01', 'cleanup-first-before');
    expect(during.token).toEqual(original); expect(during.token).toMatchObject({ retry: 0, open: true });
    expect(during.retry).toBe(0);
    const position = (label: string, kind: string) => product.events.indexOf(event(product, label, kind));
    expect(position('Base', 'wrapper-settled')).toBeLessThan(position('K01', 'cleanup-first-before'));
    expect(position('K01', 'cleanup-first-after')).toBeLessThan(position('Base', 'delegate-ending'));
    expect(event(product, 'Base', 'delegate-settled').originalOpen).toBe(false);
    const next = event(product, 'K01', 'callback-start', 1).token;
    expect(next).toMatchObject({ retry: 1, open: true }); expect(next?.id).not.toBe(original?.id);
    const before = event(product, 'K01', 'after-delegation-before'), after = event(product, 'K01', 'after-delegation-after');
    expect(before.token).toMatchObject({ id: original?.id, retry: 0, open: false }); expect(before.retry).toBe(1); expect(before.activeTokenOpen).toBe(true);
    expect(after.evidence).toEqual(before.evidence);
    const attempts = evidence(product, 'K01')!.attempts;
    expect(attempts.map(attempt => [attempt.retry, attempt.calls])).toEqual([[0, { toBe: 1 }], [1, {}]]);
    // The same native hook position supplies the state oracle; do not derive it from final status.
    expect(attempts[0].state).toBe(event(plain, 'K01', 'native-snapshot').state);
    expect(event(product, 'K01', 'native-snapshot').state).toBe(event(plain, 'K01', 'native-snapshot').state);
  });
}

for (const isolate of [undefined, false]) {
  it(`[REQ-393] same-worker multiple files and a same-session rerun keep evidence isolated (${String(isolate ?? 'default')})`,
    { timeout: 60_000 }, () => {
      const plain = runBodyIntegration({ mode: 'identity', fixture: 'files-cases', isolate, rerun: true });
      const product = runBodyIntegration({ mode: 'product', fixture: 'files-cases', isolate, rerun: true });
      paired(plain, product); expect(product.status).toBe(0); expect(product.cases).toHaveLength(2);
      for (const cases of product.cases) {
        expect(cases).toHaveLength(2);
        for (const test of cases) expect(test.meta.loomakeBody?.attempts.map(attempt => attempt.calls)).toEqual([{ toBe: 2 }]);
      }
      for (const run of [plain, product]) {
        const starts = events(run, 'M01', 'callback-start');
        expect(starts).toHaveLength(4);
        if (isolate === false) for (const phase of [0, 1]) {
          const workers = starts.filter(event => event.phase === phase).map(event => `${event.pid}:${event.threadId}`);
          expect(new Set(workers).size).toBe(1);
        }
        expect(starts.map(event => event.phase).sort()).toEqual([0, 0, 1, 1]);
        expect(new Set(starts.map(event => event.file)).size).toBe(2);
        expect(new Set(starts.map(event => event.task)).size).toBe(4);
        expect(run.events.filter(event => event.fnCalls !== undefined)).toHaveLength(8);
      }
      expect(new Set(events(product, 'M01', 'callback-start').map(event => event.token?.id)).size).toBe(4);
    });
}
