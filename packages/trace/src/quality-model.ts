import { isDeepStrictEqual } from 'node:util';
import type { Quality, QualityReport, QualityResult } from '@loomake/core';
import { aggregateCiVerdict, evaluateQualityConditions, UsageError, type QualityObservation, type StaticCommandResult } from '@loomake/kit';

export type EvaluationTarget = { commit: string; committedAt: string };
export type EvaluationBasis = { qualitySha256: string; qualityVersion: 2; model: string };
export type EvaluationRequest = { id: string; requestedAt: string; source: 'manual-cli' };
export type EvaluationSubject = {
  id: string; kind: 'product' | 'usage'; characteristic: string; subcharacteristic?: string;
  blocking: boolean; result: QualityResult; reason: string; evidence: readonly string[];
};
export type EvaluationSummary = { verdict: QualityResult; pass: number; fail: number; insufficient: number; notApplicable: number; total: number };
export type QualityEvaluation = QualityReport & {
  version: 1; runId: string; attempt: number; evaluatedAt: string;
  evaluator: { name: 'loomake'; version: string }; target: EvaluationTarget; basis: EvaluationBasis;
  commands: readonly StaticCommandResult[]; observations: readonly (QualityObservation & { observedAt: string })[];
  subjects: readonly EvaluationSubject[]; summary: { product: EvaluationSummary; usage: EvaluationSummary; blockingUnmet: readonly string[] };
  request: EvaluationRequest; period: { kind: 'utc-day'; start: string; end: string };
};

export const QUALITY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const QUALITY_SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;
export const QUALITY_HASH = /^[0-9a-f]{64}$/;
export const qualityObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const positiveInteger = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
export const nonnegativeInteger = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');
export const qualityIsoDate = (value: unknown): value is string => typeof value === 'string'
  && /^(?:\d{4}|[+-]\d{6})-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export const qualityTarget = (value: unknown): value is EvaluationTarget => qualityObject(value)
  && typeof value.commit === 'string' && QUALITY_SHA.test(value.commit) && qualityIsoDate(value.committedAt);
export const qualityBasis = (value: unknown): value is EvaluationBasis => qualityObject(value)
  && typeof value.qualitySha256 === 'string' && QUALITY_HASH.test(value.qualitySha256) && value.qualityVersion === 2 && text(value.model);
const results: readonly string[] = ['PASS', 'FAIL', 'INSUFFICIENT_EVIDENCE', 'NOT_APPLICABLE'];
const statuses: readonly string[] = ['measured', 'incomplete', 'not_run', 'unavailable', 'ineligible', 'stale', 'unverified'];
const result = (value: unknown): value is QualityResult => typeof value === 'string' && results.includes(value);

/** 観測時刻のUTC暦日。現在時刻と環境は参照しない。 */
export function utcDayPeriod(at: string): QualityEvaluation['period'] {
  if (!qualityIsoDate(at)) throw new UsageError('評価の観測時刻はUTCのISO日時にしてください');
  const day = new Date(at); day.setUTCHours(0, 0, 0, 0);
  const end = new Date(day.getTime() + 86_400_000);
  if (!Number.isFinite(end.getTime())) throw new UsageError('評価の観測期間を表せません');
  return { kind: 'utc-day', start: day.toISOString(), end: end.toISOString() };
}

function summarize(subjects: readonly EvaluationSubject[]): EvaluationSummary {
  const count = (value: QualityResult) => subjects.filter((subject) => subject.result === value).length;
  return { verdict: aggregateCiVerdict(subjects.map((subject) => subject.result)), pass: count('PASS'), fail: count('FAIL'), insufficient: count('INSUFFICIENT_EVIDENCE'), notApplicable: count('NOT_APPLICABLE'), total: subjects.length };
}

export function summarizeEvaluation(subjects: readonly EvaluationSubject[]): QualityEvaluation['summary'] {
  return {
    product: summarize(subjects.filter((subject) => subject.kind === 'product')),
    usage: summarize(subjects.filter((subject) => subject.kind === 'usage')),
    blockingUnmet: subjects.filter((subject) => subject.blocking && !['PASS', 'NOT_APPLICABLE'].includes(subject.result)).map((subject) => subject.id),
  };
}

function summaryMatches(value: unknown, expected: EvaluationSummary): boolean {
  return qualityObject(value) && value.verdict === expected.verdict
    && (['pass', 'fail', 'insufficient', 'notApplicable', 'total'] as const).every((key) => value[key] === expected[key]);
}

/** 新しい内部評価形式だけを検査し、既存coreのloose schemaは変えない。未知欄を削らない。 */
export function qualityEvaluationProblem(value: unknown): string | undefined {
  if (!qualityObject(value) || value.version !== 1 || typeof value.runId !== 'string' || !QUALITY_UUID.test(value.runId) || !positiveInteger(value.attempt)) return '評価の版・実行ID・試行番号が不正です';
  if (!qualityIsoDate(value.evaluatedAt) || !qualityObject(value.evaluator) || value.evaluator.name !== 'loomake' || !text(value.evaluator.version)) return '評価の時刻か評価器が不正です';
  if (!qualityTarget(value.target) || !qualityBasis(value.basis)) return '評価の対象か品質基準が不正です';
  if (!qualityObject(value.request) || typeof value.request.id !== 'string' || !QUALITY_UUID.test(value.request.id) || !qualityIsoDate(value.request.requestedAt) || value.request.source !== 'manual-cli') return '評価の要求が不正です';
  let period: QualityEvaluation['period'];
  try { period = utcDayPeriod(value.evaluatedAt); } catch { return '評価の観測期間を表せません'; }
  if (!qualityObject(value.period) || value.period.kind !== period.kind || value.period.start !== period.start || value.period.end !== period.end) return '評価の観測期間が観測時刻のUTC暦日と一致しません';
  if (!Array.isArray(value.commands) || !value.commands.every((entry) => qualityObject(entry) && text(entry.name) && typeof entry.result === 'string' && ['passed', 'failed', 'not_configured'].includes(entry.result))) return '評価のコマンド結果が不正です';
  if (new Set((value.commands as StaticCommandResult[]).map((entry) => entry.name)).size !== value.commands.length) return '評価のコマンド名が重複しています';
  if (!Array.isArray(value.observations) || !value.observations.every((entry) => qualityObject(entry)
    && text(entry.subject) && text(entry.source) && text(entry.metric)
    && typeof entry.status === 'string' && statuses.includes(entry.status) && qualityIsoDate(entry.observedAt)
    && (entry.value === undefined || (typeof entry.value === 'number' && Number.isFinite(entry.value)))
    && (entry.status !== 'measured' || (typeof entry.value === 'number' && Number.isFinite(entry.value)))
    && (entry.samples === undefined || nonnegativeInteger(entry.samples)) && (entry.evidence === undefined || strings(entry.evidence))
    && (entry.detail === undefined || typeof entry.detail === 'string'))) return '評価の観測の形が不正です';
  if (!Array.isArray(value.subjects) || !value.subjects.every((entry) => qualityObject(entry)
    && typeof entry.id === 'string' && ((entry.kind === 'product' && /^PQ-\d{3,}$/.test(entry.id)) || (entry.kind === 'usage' && /^UQ-\d{3,}$/.test(entry.id)))
    && text(entry.characteristic) && (entry.subcharacteristic === undefined || text(entry.subcharacteristic)) && typeof entry.blocking === 'boolean'
    && result(entry.result) && typeof entry.reason === 'string' && strings(entry.evidence))) return '評価の品質別判定が不正です';
  if (new Set((value.subjects as EvaluationSubject[]).map((subject) => subject.id)).size !== value.subjects.length) return '評価の品質IDが重複しています';
  const expected = summarizeEvaluation(value.subjects as EvaluationSubject[]);
  if (!qualityObject(value.summary) || !summaryMatches(value.summary.product, expected.product) || !summaryMatches(value.summary.usage, expected.usage)
    || !isDeepStrictEqual(value.summary.blockingUnmet, expected.blockingUnmet)) return '評価の集約が個別判定と一致しません';
  return undefined;
}

export type EvaluationInput = {
  quality: Quality; observations: readonly QualityObservation[]; commands: readonly StaticCommandResult[];
  runId: string; attempt: number; evaluatedAt: string; evaluatorVersion: string;
  target: EvaluationTarget; basis: EvaluationBasis; request: EvaluationRequest;
};

/** W1の静的観測をkitの判定へ渡す。利用時品質の観測は作らず、参考指標を合格根拠にしない。 */
export function buildQualityEvaluation(input: EvaluationInput): QualityEvaluation {
  const { quality } = input;
  if (input.basis.model !== quality.model) throw new UsageError('評価の品質モデルと基準が一致しません');
  const observations = input.observations.filter((observation) => Object.hasOwn(quality.product, observation.subject));
  const checks = evaluateQualityConditions(quality, observations);
  const subjects: EvaluationSubject[] = [];
  type Item = { characteristic: string; subcharacteristic?: unknown; blocking?: boolean };
  const appendSubjects = (kind: EvaluationSubject['kind'], items: Readonly<Record<string, Item>>) => {
    for (const [id, item] of Object.entries(items)) {
      const check = checks.find((candidate) => candidate.id === `quality:${id}`);
      if (!check) throw new UsageError('品質対象に対応する判定がありません');
      subjects.push({
        id, kind, characteristic: item.characteristic,
        ...(kind === 'product' && typeof item.subcharacteristic === 'string' ? { subcharacteristic: item.subcharacteristic } : {}),
        blocking: item.blocking === true, result: check.result, reason: check.reason, evidence: [...check.evidence],
      });
    }
  };
  appendSubjects('usage', quality.objectives);
  appendSubjects('product', quality.product);
  const evaluation: QualityEvaluation = {
    version: 1, runId: input.runId, attempt: input.attempt, evaluatedAt: input.evaluatedAt,
    evaluator: { name: 'loomake', version: input.evaluatorVersion }, target: { ...input.target }, basis: { ...input.basis },
    commands: input.commands.map((command) => ({ ...command })),
    observations: observations.map((observation) => ({
      ...observation, ...(observation.evidence ? { evidence: [...observation.evidence] } : {}), observedAt: input.evaluatedAt,
    })),
    subjects, summary: summarizeEvaluation(subjects), request: { ...input.request }, period: utcDayPeriod(input.evaluatedAt),
  };
  const problem = qualityEvaluationProblem(evaluation);
  if (problem) throw new UsageError(problem);
  return evaluation;
}
