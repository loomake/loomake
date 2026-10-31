import type { Quality, QualityMeasure, QualityResult, VerifyCheckV2, VerifyScope } from '@loomake/core';
import { aggregateCiVerdict } from './quality-verdict.js';

/**
 * 1 つの指標の観測。適格性（版・対象・手順・鮮度）と実施の確認は、呼び出し側が先に済ませて status に入れる。
 * measured：適格で実施を確かめた完全な値。incomplete：集計が終わっていない値。
 * not_run：未実施。unavailable：取得できない。ineligible：適格性を確かめていない。stale：古い。unverified：照合していない
 */
export type QualityObservation = {
  /** 対象の ID（UQ-xxx・PQ-xxx） */
  subject: string;
  source: string;
  metric: string;
  status: 'measured' | 'incomplete' | 'not_run' | 'unavailable' | 'ineligible' | 'stale' | 'unverified';
  value?: number;
  samples?: number;
  /** 根拠への参照。check の evidence へ写す */
  evidence?: readonly string[];
};

const STATUS_REASON: Record<Exclude<QualityObservation['status'], 'measured'>, string> = {
  incomplete: '集計が終わっていません',
  not_run: '実施されていません',
  unavailable: '取得できません',
  ineligible: '適格性を確かめていません',
  stale: '古い証拠です',
  unverified: '照合していません',
};

type Outcome = { result: 'PASS' | 'FAIL' | 'INSUFFICIENT_EVIDENCE'; reason: string; evidence: readonly string[] };

const TARGET = /^(<=|>=|==|<|>)\s*(-?[0-9]+(?:\.[0-9]+)?)$/;
const compare = (op: string, value: number, bound: number) =>
  op === '<=' ? value <= bound : op === '>=' ? value >= bound : op === '==' ? value === bound : op === '<' ? value < bound : value > bound;

function evaluateMeasure(subject: string, measure: QualityMeasure, minDefault: number | undefined, observations: readonly QualityObservation[]): Outcome {
  const label = `${measure.source} ${measure.metric}`;
  const insufficient = (why: string, evidence: readonly string[] = []): Outcome => ({ result: 'INSUFFICIENT_EVIDENCE', reason: `${label}：${why}`, evidence });
  const target = measure.target === undefined ? undefined : TARGET.exec(measure.target);
  if (!target) return insufficient('target が未定義です');
  const matched = observations.filter((o) => o.subject === subject && o.source === measure.source && o.metric === measure.metric);
  if (matched.length === 0) return insufficient('観測がありません');
  if (matched.length > 1) return insufficient('同じ指標の観測が複数あり、照合できません', matched.flatMap((o) => o.evidence ?? []));
  const [observation] = matched;
  const evidence = observation.evidence ?? [];
  if (observation.status !== 'measured') return insufficient(STATUS_REASON[observation.status], evidence);
  if (typeof observation.value !== 'number' || !Number.isFinite(observation.value)) return insufficient('有限の数値がありません', evidence);
  const min = measure.min_samples ?? minDefault;
  if (min !== undefined && !(typeof observation.samples === 'number' && observation.samples >= min)) {
    return insufficient(`サンプル数が足りません（${observation.samples ?? 0}/${min}）`, evidence);
  }
  const [, op, bound] = target;
  return compare(op, observation.value, Number(bound))
    ? { result: 'PASS', reason: `${label}：${observation.value} は ${measure.target} を満たします`, evidence }
    : { result: 'FAIL', reason: `${label}：${observation.value} は ${measure.target} を満たしません`, evidence };
}

type Item = { characteristic: string; evidence: QualityMeasure[]; applicability?: string; reason?: string; confirmed_by?: string };
const subjectsOf = (quality: Quality): [string, Item][] => [...Object.entries(quality.objectives), ...Object.entries(quality.product)] as [string, Item][];

/**
 * quality の各対象（UQ・PQ）を、観測から PASS・FAIL・INSUFFICIENT_EVIDENCE・NOT_APPLICABLE に判定する（REQ-313）。
 * 必須証拠（evidence）だけを使い、参考指標（indicators）は合格の根拠にしない。適格な違反が 1 つでもあれば FAIL を優先し、
 * 次に不足、すべての必須証拠が満たされたときだけ PASS にする。入力を変えず、I/O・環境・時計を読まない
 */
export function evaluateQualityConditions(quality: Quality, observations: readonly QualityObservation[]): VerifyCheckV2[] {
  return subjectsOf(quality).map(([subject, item]): VerifyCheckV2 => {
    const id = `quality:${subject}`;
    if (item.applicability === 'not_applicable') {
      return item.reason && item.confirmed_by
        ? { id, result: 'NOT_APPLICABLE', reason: `対象外：${item.reason}（確認者：${item.confirmed_by}）`, evidence: [`quality:${subject}`] }
        : { id, result: 'INSUFFICIENT_EVIDENCE', reason: '対象外の理由か確認者がありません', evidence: [] };
    }
    if (item.evidence.length === 0) return { id, result: 'INSUFFICIENT_EVIDENCE', reason: '合格に必要な証拠が定義されていません', evidence: [] };
    const outcomes = item.evidence.map((measure) => evaluateMeasure(subject, measure, quality.defaults?.min_samples, observations));
    const result = outcomes.some((o) => o.result === 'FAIL') ? 'FAIL' : outcomes.some((o) => o.result === 'INSUFFICIENT_EVIDENCE') ? 'INSUFFICIENT_EVIDENCE' : 'PASS';
    return {
      id,
      result,
      reason: outcomes.filter((o) => result === 'PASS' || o.result === result).map((o) => o.reason).join(' / '),
      evidence: [...new Set(outcomes.flatMap((o) => o.evidence))],
    };
  });
}

/**
 * 品質の対象がないことを、ほかのゲートの PASS で相殺しないための check `quality:subjects`（REQ-314）。
 * 対象 0・全件が対象外・合格証拠の定義がひとつもないときは不足にする
 */
export function qualitySubjectsGuard(quality: Quality): VerifyCheckV2 {
  const applicable = subjectsOf(quality).filter(([, item]) => item.applicability !== 'not_applicable');
  const withEvidence = applicable.filter(([, item]) => item.evidence.length > 0);
  if (applicable.length === 0) {
    return { id: 'quality:subjects', result: 'INSUFFICIENT_EVIDENCE', reason: subjectsOf(quality).length ? '品質の対象がすべて対象外です' : '品質の対象がありません', evidence: [] };
  }
  if (withEvidence.length === 0) return { id: 'quality:subjects', result: 'INSUFFICIENT_EVIDENCE', reason: '合格に必要な証拠を定義した品質の対象がありません', evidence: [] };
  return { id: 'quality:subjects', result: 'PASS', reason: `合格に必要な証拠を定義した品質の対象：${withEvidence.length} 件`, evidence: withEvidence.map(([subject]) => `quality:${subject}`) };
}

export type CiSummary = { fail: number; insufficient: number; not_applicable: number; evaluated: number };
export type ChecksSummary =
  | { scope: 'ci'; summary: CiSummary; verdict: QualityResult }
  | { scope: 'local'; summary: CiSummary & { pending: number } };

/**
 * checks の件数を数える（REQ-314）。evaluated は PASS・FAIL・不足・NA を含む全件。ci は既存の集約で verdict を返し、
 * local は不足を pending に数えて verdict を返さない。decision は品質判定とは別の軸なので、ここでは扱わない
 */
export function summarizeVerifyChecks(checks: readonly VerifyCheckV2[], scope: VerifyScope): ChecksSummary {
  const count = (result: QualityResult) => checks.filter((c) => c.result === result).length;
  const summary = { fail: count('FAIL'), insufficient: count('INSUFFICIENT_EVIDENCE'), not_applicable: count('NOT_APPLICABLE'), evaluated: checks.length };
  return scope === 'ci'
    ? { scope, summary, verdict: aggregateCiVerdict(checks.map((c) => c.result)) }
    : { scope, summary: { ...summary, pending: summary.insufficient } };
}
