import { describe, expect, it } from 'vitest';
import { buildEfficiencyTable, type EffortChangeRecords, type EffortInputs, type EffortLocation, type EffortObservation, type ManualEffortRecord } from '../src/index.js';

const SHA = '0'.repeat(64);
const at = (path: string, line?: number) => ({ path, ...(line === undefined ? {} : { line }) });
const total = (minutes: number, extra: Partial<EffortObservation> = {}, path = 'docs/effort/a.md', line = 20): EffortObservation => ({ source: at(path, line), totalMinutes: minutes, ...extra });
const manual = (path: string, id: string, over: Partial<ManualEffortRecord> = {}): ManualEffortRecord => ({
  path, sha256: SHA, change: { status: 'single', id }, comparison: 'estimate', baseline: 'human',
  estimate: { minMinutes: 1440, maxMinutes: 3480, line: 12 }, actuals: [], problems: [], ...over,
});
const json = (change: string, observations: EffortObservation[], invalid?: string): EffortChangeRecords =>
  ({ change, observations, files: observations.map((o) => o.source.path), ...(invalid === undefined ? {} : { invalid }) });
const inputs = (m: ManualEffortRecord[], c: EffortChangeRecords[] = [], locations: Record<string, EffortLocation> = {}): EffortInputs => {
  const known = Object.fromEntries([...m.flatMap((r) => (r.change.status === 'single' ? [r.change.id] : [])), ...c.map((x) => x.change)].map((id) => [id, 'active' as const]));
  return { manual: m, changes: c, locations: { ...known, ...locations } };
};
const only = (m: ManualEffortRecord[], c: EffortChangeRecords[] = [], l: Record<string, EffortLocation> = {}) => buildEfficiencyTable(inputs(m, c, l)).rows[0]!;

describe('開発効率の表の集計', () => {
  it('[REQ-468] 行は推定の行、人力実測ありの行の順で、手書き記録のpath、記録だけのchange-idの辞書順に並ぶ', () => {
    const rows = buildEfficiencyTable(inputs(
      [manual('docs/effort/b.md', 'b'), manual('docs/effort/a.md', 'a', { comparison: 'measured' }), manual('docs/effort/c.md', 'x', { change: { status: 'unmapped', reason: 'change 未作成' } })],
      [json('z-only', [total(5, {}, '.loomake/evidence/z-only/effort/f.json', 1)]), json('a-only', [total(5, {}, '.loomake/evidence/a-only/effort/f.json', 1)])],
    )).rows;
    expect(rows.map((r) => [r.group, r.change])).toEqual([
      ['estimate', 'b'], ['estimate', '未対応：docs/effort/c.md（change 未作成）'], ['estimate', 'a-only'], ['estimate', 'z-only'], ['measured', 'a']]);
  });
  it('[REQ-468] 総計だけ・5区分すべて・一部の区分だけ・記録なしを、合計・部分計・不明に分ける', () => {
    expect(only([manual('docs/effort/a.md', 'a', { actuals: [total(30), total(60)] })]).actual).toEqual({ status: 'value', value: { totalMinutes: 90 } });
    const all = { instruct: 1, review: 2, rework: 3, run: 4, wait: 5 };
    const full = only([manual('docs/effort/a.md', 'a', { actuals: [{ source: at('p', 1), minutes: all }] })]);
    expect(full.actual).toEqual({ status: 'value', value: { totalMinutes: 15, minutes: all } });
    const some = only([manual('docs/effort/a.md', 'a', { actuals: [{ source: at('p', 1), minutes: { instruct: 10, review: 20 } }, total(30)] })]);
    expect(some.actual).toEqual({ status: 'partial', known: { totalMinutes: 60 }, reason: expect.stringContaining('内訳不明') });
    expect(some.reduction).toMatchObject({ status: 'missing' });
    expect(only([manual('docs/effort/a.md', 'a')]).actual).toMatchObject({ status: 'missing', reason: '実績の記録がありません' });
  });
  it('[REQ-468] searchは合計に入らず、総計0分は観測値として100.0%の削減率になる', () => {
    const row = only([manual('docs/effort/a.md', 'a', { actuals: [{ source: at('p', 1), minutes: { instruct: 10, run: 20, search: 15 } }] })]);
    expect(row.actual).toMatchObject({ status: 'partial', known: { totalMinutes: 30 } });
    const zero = only([manual('docs/effort/a.md', 'a', { actuals: [total(0)] })]);
    expect(zero.actual).toEqual({ status: 'value', value: { totalMinutes: 0 } });
    expect(zero.reduction).toEqual({ status: 'value', value: { lowerPermille: 1000, upperPermille: 1000 } });
  });
  it('[REQ-468] 削減率は切り捨てた0.1%単位で、負の率・幅0・逆転・0分母・推定なしを区別する', () => {
    const reduction = (minMinutes: number, maxMinutes: number, a: number) =>
      only([manual('docs/effort/a.md', 'a', { estimate: { minMinutes, maxMinutes, line: 12 }, actuals: [total(a)] })]).reduction;
    expect(reduction(1440, 3480, 1620)).toEqual({ status: 'value', value: { lowerPermille: -125, upperPermille: 534 } });
    expect(reduction(1440, 3480, 4000)).toEqual({ status: 'value', value: { lowerPermille: -1778, upperPermille: -150 } });
    expect(reduction(100, 100, 87)).toEqual({ status: 'value', value: { lowerPermille: 130, upperPermille: 130 } });
    for (const [min, max] of [[10, 5], [0, 5], [0, 0]] as const) expect(reduction(min, max, 3)).toMatchObject({ status: 'missing' });
    const none = only([manual('docs/effort/a.md', 'a', { estimate: { missing: '推定の表がありません' }, actuals: [total(3)] })]);
    expect(none.estimate).toEqual({ status: 'missing', reason: '推定の表がありません' });
    expect(none.reduction).toMatchObject({ status: 'missing' });
  });
  it('[REQ-468] 手書きの実績行と同じchangeの--effortの両方、または複数の手書き記録は合算せず重複の理由つきで算出不能にする', () => {
    const both = only([manual('docs/effort/a.md', 'a', { actuals: [total(30)] })], [json('a', [total(60, {}, '.loomake/evidence/a/effort/f.json', 1)])]);
    for (const key of ['actual', 'decisions', 'attempts', 'cost', 'reduction'] as const) expect(both[key], key).toMatchObject({ status: 'missing' });
    expect(both.actual).toMatchObject({ reason: expect.stringContaining('重複') });
    expect(both.sources.effort).toEqual(['.loomake/evidence/a/effort/f.json']);
    const rows = buildEfficiencyTable(inputs([manual('docs/effort/a.md', 'a', { actuals: [total(1)] }), manual('docs/effort/b.md', 'a', { actuals: [total(2)] })])).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.estimate).toMatchObject({ status: 'missing', reason: expect.stringContaining('複数') });
    expect(rows[0]?.sources.manual.map((m) => m.path)).toEqual(['docs/effort/a.md', 'docs/effort/b.md']);
    const empty = only([manual('docs/effort/a.md', 'a')], [json('a', [total(60, {}, '.loomake/evidence/a/effort/f.json', 1)])]);
    expect(empty.actual).toEqual({ status: 'value', value: { totalMinutes: 60 } });
  });
  it('[REQ-468] 判断要求・試行・費用は全てにあれば合計、一部なら部分計、なければ不明で、費用は区分をまたいで足さない', () => {
    const row = only([manual('docs/effort/a.md', 'a', { actuals: [
      total(10, { decisions: 2, attempts: 1, cost: [{ kind: 'actual-usd', cents: 125 }, { kind: 'tokens', count: 100 }] }),
      total(10, { decisions: 3, cost: [{ kind: 'actual-usd', cents: 25 }] })] })]);
    expect(row.decisions).toEqual({ status: 'value', value: 5 });
    expect(row.attempts).toMatchObject({ status: 'partial', known: 1 });
    expect(row.cost).toEqual({ status: 'value', value: {
      'actual-usd': { status: 'value', value: 150 }, tokens: { status: 'partial', known: 100, reason: expect.any(String) } } });
    const none = only([manual('docs/effort/a.md', 'a', { actuals: [total(10)] })]);
    expect([none.decisions.status, none.attempts.status, none.cost.status]).toEqual(['missing', 'missing', 'missing']);
  });
  it('[REQ-468] 人力実測ありの記録は別の群の行で、削減率は人力実測の値がない理由つきの不明になる', () => {
    const row = only([manual('docs/effort/a.md', 'a', { comparison: 'measured', actuals: [total(30)] })]);
    expect(row.group).toBe('measured');
    expect(row.comparison).toEqual({ status: 'value', value: 'measured' });
    expect(row.reduction).toMatchObject({ status: 'missing', reason: expect.stringContaining('人力実測') });
  });
  it('[REQ-468] 各値が安全な整数でも合計が超えれば、その欄を理由つきの不明にし、例外を投げない', () => {
    const big = Number.MAX_SAFE_INTEGER;
    const row = only([manual('docs/effort/a.md', 'a', { actuals: [total(1, { decisions: big, cost: [{ kind: 'tokens', count: big }] }), total(1, { decisions: 1, cost: [{ kind: 'tokens', count: 1 }] })] })]);
    expect(row.decisions).toMatchObject({ status: 'missing', reason: expect.stringContaining('安全な整数') });
    expect(row.cost).toMatchObject({ value: { tokens: { status: 'missing' } } });
    const huge = only([manual('docs/effort/a.md', 'a', { estimate: { minMinutes: 1, maxMinutes: 1, line: 1 }, actuals: [total(big)] })]);
    expect(huge.reduction).toMatchObject({ status: 'missing', reason: expect.stringContaining('安全な整数') });
  });
  it('[REQ-468] 記録だけのchangeは推定が不明で、所在が見つからない・あいまいなときは表示に付記し、手書きとは結びつけない', () => {
    const row = only([], [json('add-x', [total(60, {}, '.loomake/evidence/add-x/effort/f.json', 1)])], { 'add-x': 'missing' });
    expect(row.change).toBe('add-x（change が見つかりません）');
    expect(row.estimate).toMatchObject({ status: 'missing', reason: expect.stringContaining('W7') });
    expect(only([], [json('add-y', [total(60, {}, 'p', 1)])], { 'add-y': 'ambiguous' }).change).toBe('add-y（change があいまいです）');
    const bad = only([], [json('add-z', [], 'f.json の内容が不正です')]);
    expect(bad.actual).toMatchObject({ status: 'missing', reason: 'f.json の内容が不正です' });
  });
  it('[REQ-468] 入力を変えず、同じ入力から同じ表を返す', () => {
    const input = inputs([manual('docs/effort/a.md', 'a', { actuals: [total(30)] })], [json('b', [total(5, {}, 'p', 1)])]);
    const copy = structuredClone(input);
    const first = buildEfficiencyTable(input);
    expect(buildEfficiencyTable(input)).toEqual(first);
    expect(input).toEqual(copy);
  });
});
