import type { EffortChangeRecords, EffortInputs, EffortObservation, ManualEffortRecord } from './effort-types.js';
import type { EfficiencyRow, EfficiencyTable, EfficiencyValue } from './effort-table-types.js';
import { actualOf, attemptsOf, costOf, decisionsOf, missing, reductionOf } from './effort-aggregate.js';

const MULTIPLE = '複数の手書き記録が同じ change を示します';
const DUPLICATE = '手書きと --effort の両方に実績があり、重複を確かめていません';
const NO_MANUAL = '手書き記録がなく、自動推定は W7 の範囲です';
const MEASURED = '人力実測の値を記録する欄がないため比較できません';
const UNREADABLE = '手書き記録から読み取れません';
const byCode = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** 実績の入口。使えない理由があれば list の代わりに blocked を返す */
type Entries = { list: EffortObservation[] } | { blocked: string };

function entriesOf(records: ManualEffortRecord[], json: EffortChangeRecords | undefined): Entries {
  const manual = records.at(0)?.actuals;
  const own = manual && Array.isArray(manual) ? manual : [];
  if (records.length > 1) return { blocked: MULTIPLE };
  if (manual && !Array.isArray(manual)) return { blocked: manual.invalid };
  if (own.length > 0 && json) return { blocked: DUPLICATE };
  return json?.invalid !== undefined ? { blocked: json.invalid } : { list: own.length > 0 ? own : json?.observations ?? [] };
}

const whole = <T>(records: ManualEffortRecord[], pick: (r: ManualEffortRecord) => T | null): EfficiencyValue<T> => {
  if (records.length === 0) return missing(NO_MANUAL);
  if (records.length > 1) return missing(MULTIPLE);
  const value = pick(records[0]);
  return value === null ? missing(UNREADABLE) : { status: 'value', value };
};

function estimateOf(records: ManualEffortRecord[]): EfficiencyRow['estimate'] {
  const pick = (r: ManualEffortRecord) => ('missing' in r.estimate ? null : { minMinutes: r.estimate.minMinutes, maxMinutes: r.estimate.maxMinutes });
  const value = whole(records, pick);
  const first = records.at(0)?.estimate;
  return value.status === 'missing' && records.length === 1 && first && 'missing' in first ? missing(first.missing) : value;
}

function reductionFor(group: EfficiencyRow['group'], estimate: EfficiencyRow['estimate'], actual: EfficiencyRow['actual']): EfficiencyRow['reduction'] {
  if (group === 'measured') return missing(MEASURED);
  if (estimate.status !== 'value') return missing(estimate.status === 'missing' ? estimate.reason : '推定が不明です');
  if (actual.status !== 'value') return missing('実績が部分計か不明のため算出できません');
  return reductionOf(estimate.value.minMinutes, estimate.value.maxMinutes, actual.value.totalMinutes);
}

function sourcesOf(records: ManualEffortRecord[], json: EffortChangeRecords | undefined): EfficiencyRow['sources'] {
  const lines = (r: ManualEffortRecord): number[] => [...('missing' in r.estimate ? [] : [r.estimate.line]), ...(Array.isArray(r.actuals) ? r.actuals.flatMap((o) => o.source.line ?? []) : [])];
  const manual = records.map((r) => ({ path: r.path, sha256: r.sha256, lines: [...new Set(lines(r))].sort((a, b) => a - b) }));
  return { manual, effort: json?.files ?? [] };
}

function tablePart(entries: Entries): Pick<EfficiencyRow, 'actual' | 'decisions' | 'attempts' | 'cost'> {
  if ('blocked' in entries) return { actual: missing(entries.blocked), decisions: missing(entries.blocked), attempts: missing(entries.blocked), cost: missing(entries.blocked) };
  const { list } = entries;
  return { actual: actualOf(list), decisions: decisionsOf(list), attempts: attemptsOf(list), cost: costOf(list) };
}

function rowOf(records: ManualEffortRecord[], json: EffortChangeRecords | undefined, change: string): EfficiencyRow {
  const group: EfficiencyRow['group'] = records.length > 0 && records.every((r) => r.comparison === 'measured') ? 'measured' : 'estimate';
  const part = tablePart(entriesOf(records, json));
  const estimate = estimateOf(records);
  const common = { group, change, estimate, ...part, reduction: reductionFor(group, estimate, part.actual), sources: sourcesOf(records, json) };
  return { ...common, baseline: whole(records, (r) => r.baseline), comparison: whole(records, (r) => r.comparison) };
}

const SUFFIX = { missing: '（change が見つかりません）', ambiguous: '（change があいまいです）', active: '', archived: '' } as const;

function manualRows(inputs: EffortInputs): { claimed: Set<string>; rows: EfficiencyRow[] } {
  const groups = new Map<string, ManualEffortRecord[]>();
  const mapped = inputs.manual.filter((r) => r.change.status === 'single');
  for (const r of mapped) groups.set((r.change as { id: string }).id, [...(groups.get((r.change as { id: string }).id) ?? []), r]);
  const single = [...groups.entries()].map(([id, records]) => rowOf(records, inputs.changes.find((c) => c.change === id), id));
  const unmapped = inputs.manual.filter((r) => r.change.status === 'unmapped').map((r) => rowOf([r], undefined, `未対応：${r.path}（${(r.change as { reason: string }).reason}）`));
  return { claimed: new Set(groups.keys()), rows: [...single, ...unmapped] };
}

function jsonRows(inputs: EffortInputs, claimed: Set<string>): EfficiencyRow[] {
  return inputs.changes.filter((c) => !claimed.has(c.change))
    .map((c) => rowOf([], c, `${c.change}${SUFFIX[inputs.locations[c.change] ?? 'active']}`));
}

const firstPath = (row: EfficiencyRow): string => row.sources.manual.at(0)?.path ?? '';

/** 手書き記録と Effort 1 から、推定との差の行を作る純関数。時計・git・I/O を使わない */
export function buildEfficiencyTable(inputs: EffortInputs): EfficiencyTable {
  const { claimed, rows } = manualRows(inputs);
  const manual = rows.sort((a, b) => byCode(firstPath(a), firstPath(b)));
  const ordered = [...manual, ...jsonRows(inputs, claimed).sort((a, b) => byCode(a.change, b.change))];
  return { rows: [...ordered.filter((r) => r.group === 'estimate'), ...ordered.filter((r) => r.group === 'measured')] };
}
