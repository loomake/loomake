import type { EffortCost, EffortMinutes } from '@loomake/core';
import type { EffortObservation } from './effort-types.js';
import type { EfficiencyActual, EfficiencyCost, EfficiencyValue } from './effort-table-types.js';

const CATEGORIES = ['instruct', 'review', 'rework', 'run', 'wait'] as const;
const KINDS = ['actual-usd', 'estimated-usd', 'tokens'] as const;
const OVERFLOW = '合計が安全な整数の範囲を超えます';
export const NO_ACTUAL = '実績の記録がありません';
export const missing = <T>(reason: string): EfficiencyValue<T> => ({ status: 'missing', reason });

/** 安全な整数のまま合計する。超えたら null */
export function safeSum(values: number[]): number | null {
  let sum = 0;
  for (const value of values) {
    sum += value;
    if (!Number.isSafeInteger(sum)) return null;
  }
  return sum;
}

/** 全エントリが値を持てば合計、一部なら部分計、なければ不明 */
function countOf(values: (number | undefined)[], none: string, partialText: string): EfficiencyValue<number> {
  const known = values.filter((v): v is number => v !== undefined);
  const sum = safeSum(known);
  if (known.length === 0) return missing(none);
  if (sum === null) return missing(OVERFLOW);
  return known.length === values.length ? { status: 'value', value: sum } : { status: 'partial', known: sum, reason: partialText };
}

const hasAll = (minutes: EffortMinutes): boolean => CATEGORIES.every((key) => minutes[key] !== undefined);
const entryTotal = (o: EffortObservation): number | undefined => ('totalMinutes' in o ? o.totalMinutes : hasAll(o.minutes) ? safeSum(CATEGORIES.map((k) => o.minutes[k] ?? 0)) ?? undefined : undefined);
const entryKnown = (o: EffortObservation): number => ('totalMinutes' in o ? o.totalMinutes : CATEGORIES.reduce((sum, k) => sum + (o.minutes[k] ?? 0), 0));

function breakdown(list: EffortObservation[]): EfficiencyActual['minutes'] {
  const all = list.every((o) => 'minutes' in o);
  const keys = [...CATEGORIES, 'search'] as const;
  const common = keys.filter((k) => all && list.every((o) => 'minutes' in o && o.minutes[k] !== undefined));
  return common.length ? Object.fromEntries(common.map((k) => [k, list.reduce((sum, o) => sum + ('minutes' in o ? o.minutes[k] ?? 0 : 0), 0)])) : undefined;
}

/** 人の実績。search は合計にも部分計にも足さない */
export function actualOf(list: EffortObservation[]): EfficiencyValue<EfficiencyActual> {
  if (list.length === 0) return missing(NO_ACTUAL);
  const totals = list.map(entryTotal);
  const sum = safeSum(totals.every((t) => t !== undefined) ? totals : list.map(entryKnown));
  if (sum === null) return missing(OVERFLOW);
  if (totals.some((t) => t === undefined)) return { status: 'partial', known: { totalMinutes: sum }, reason: '一部の記録は区分の一部だけで、内訳不明です' };
  return wholeActual(list, sum);
}

function wholeActual(list: EffortObservation[], sum: number): EfficiencyValue<EfficiencyActual> {
  const minutes = breakdown(list);
  return { status: 'value', value: { totalMinutes: sum, ...(minutes ? { minutes } : {}) } };
}

export const decisionsOf = (list: EffortObservation[]): EfficiencyValue<number> =>
  list.length === 0 ? missing(NO_ACTUAL) : countOf(list.map((o) => o.decisions), '判断要求の記録がありません', '一部の記録に判断要求がありません');
export const attemptsOf = (list: EffortObservation[]): EfficiencyValue<number> =>
  list.length === 0 ? missing(NO_ACTUAL) : countOf(list.map((o) => o.attempts), '試行の記録がありません', '一部の記録に試行がありません');

const amount = (cost: EffortCost): number => ('count' in cost ? cost.count : cost.cents);
const costOf1 = (o: EffortObservation, kind: EffortCost['kind']): number | undefined => {
  const found = o.cost?.find((c) => c.kind === kind);
  return found ? amount(found) : undefined;
};

/** 費用は区分ごとに同じ規則で数え、区分をまたいで足さない */
export function costOf(list: EffortObservation[]): EfficiencyValue<EfficiencyCost> {
  if (list.length === 0) return missing(NO_ACTUAL);
  const kinds = KINDS.filter((kind) => list.some((o) => costOf1(o, kind) !== undefined));
  if (kinds.length === 0) return missing('費用の記録がありません');
  const entries = kinds.map((kind) => [kind, countOf(list.map((o) => costOf1(o, kind)), '', '一部の記録に費用がありません')]);
  return { status: 'value', value: Object.fromEntries(entries) as EfficiencyCost };
}

const floorDiv = (n: bigint, d: bigint): bigint => (n % d !== 0n && n < 0n ? n / d - 1n : n / d);
const permille = (bound: number, actual: number): bigint => floorDiv(1000n * (BigInt(bound) - BigInt(actual)), BigInt(bound));
const safe = (v: bigint): boolean => v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER);

/** 推定に対する削減率。整数（BigInt）の床除算で、千分率にする */
export function reductionOf(min: number, max: number, actual: number): EfficiencyValue<{ lowerPermille: number; upperPermille: number }> {
  if (min > max) return missing('推定の最小が最大を超えています');
  if (min <= 0) return missing('推定の最小が 0 分のため割れません');
  const [lower, upper] = [permille(min, actual), permille(max, actual)];
  if (!safe(lower) || !safe(upper)) return missing(OVERFLOW);
  return { status: 'value', value: { lowerPermille: Number(lower), upperPermille: Number(upper) } };
}
