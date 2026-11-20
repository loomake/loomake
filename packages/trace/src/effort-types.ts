import type { EffortCost, EffortMinutes, ParseError } from '@loomake/core';

/** 出典。path は root からの POSIX 相対パス */
export type EffortSource = { path: string; line?: number };
/** 省略は欠測で、0 では補わない */
export type EffortObservation = { source: EffortSource; decisions?: number; attempts?: number; cost?: EffortCost[] }
  & ({ totalMinutes: number } | { minutes: EffortMinutes });
export type ChangeRef = { status: 'single'; id: string } | { status: 'unmapped'; reason: string };
export type ManualEstimate = { minMinutes: number; maxMinutes: number; line: number } | { missing: string };
export type ManualEffortRecord = {
  path: string;
  /** 原本 bytes（BOM・CRLF を含む）の SHA-256 */
  sha256: string;
  change: ChangeRef;
  comparison: 'estimate' | 'measured' | null;
  baseline: 'human' | 'ai-assisted' | null;
  estimate: ManualEstimate;
  /** 不正な行が 1 つでもあれば、実績全体を算出不能にする */
  actuals: EffortObservation[] | { invalid: string };
  /** 固定の日本語。セルの原文は含めない */
  problems: ParseError[];
};
export type EffortChangeRecords = { change: string; observations: EffortObservation[]; files: string[]; invalid?: string };
export type EffortLocation = 'active' | 'archived' | 'missing' | 'ambiguous';
export type EffortInputs = {
  /** path の辞書順 */
  manual: ManualEffortRecord[];
  /** change-id の辞書順 */
  changes: EffortChangeRecords[];
  locations: Record<string, EffortLocation>;
};
