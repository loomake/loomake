import type { EffortCost, EffortMinutes } from '@loomake/core';

/** 欠測は値・部分計・不明の 3 状態で持ち、0 と区別する。部分計は全体の値へ昇格させない */
export type EfficiencyValue<T> =
  | { status: 'value'; value: T }
  | { status: 'partial'; known: T; reason: string }
  | { status: 'missing'; reason: string };
export type EfficiencyActual = { totalMinutes: number; minutes?: Partial<Record<keyof EffortMinutes, number>> };
export type EfficiencyCost = Partial<Record<EffortCost['kind'], EfficiencyValue<number>>>;
export type EfficiencySources = {
  manual: { path: string; sha256: string; lines: number[] }[];
  /** root からの POSIX 相対パス */
  effort: string[];
};
export type EfficiencyRow = {
  group: 'estimate' | 'measured';
  /** 表示用。未対応の記録や所在のない change は付記つき */
  change: string;
  baseline: EfficiencyValue<'human' | 'ai-assisted'>;
  estimate: EfficiencyValue<{ minMinutes: number; maxMinutes: number }>;
  actual: EfficiencyValue<EfficiencyActual>;
  /** 千分率の整数。floor で切り捨てる */
  reduction: EfficiencyValue<{ lowerPermille: number; upperPermille: number }>;
  comparison: EfficiencyValue<'estimate' | 'measured'>;
  decisions: EfficiencyValue<number>;
  attempts: EfficiencyValue<number>;
  cost: EfficiencyValue<EfficiencyCost>;
  sources: EfficiencySources;
};
export type EfficiencyTable = { rows: EfficiencyRow[] };
