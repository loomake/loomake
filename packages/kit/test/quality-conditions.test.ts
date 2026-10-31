import { describe, it, expect } from 'vitest';
import { loadQualitySchema, loadVerifyResultSchemas, type Quality, type QualityInput, type VerifyCheckV2 } from '@loomake/core';
import { evaluateQualityConditions, qualitySubjectsGuard, summarizeVerifyChecks, verifyExitCode, type QualityObservation } from '../src/index.js';

const { qualitySchema } = await loadQualitySchema();
const { verifyResultV2Schema } = await loadVerifyResultSchemas();

const SOURCE = 'ci.test_report';
const METRIC = 'required_subjects_with_failed_tests';
// 入力の形はスキーマで確かめる。型の上では緩く受ける
const quality = (product: Record<string, object>, extra: Partial<QualityInput> = {}): Quality => qualitySchema.parse({ version: 2, model: 'm', product, ...extra });
const measure = (target: string | undefined, min_samples?: number) => ({ source: SOURCE, metric: METRIC, ...(target ? { target } : {}), ...(min_samples ? { min_samples } : {}) });
const observed = (value: number, extra: Partial<QualityObservation> = {}): QualityObservation => ({ subject: 'PQ-900', source: SOURCE, metric: METRIC, status: 'measured', value, samples: 3, evidence: ['report:sha256:a'], ...extra });
const one = (target: string, observation: QualityObservation | undefined, min?: number) =>
  evaluateQualityConditions(quality({ 'PQ-900': { characteristic: 'c', evidence: [measure(target, min)] } }), observation ? [observation] : [])[0];

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value)) deepFreeze(entry);
  }
  return value;
}

describe('限定した品質条件の純粋判定', () => {
  it('[REQ-313] 5 つの比較演算子の境界・境界外を、必須条件の充足と違反に分ける', () => {
    const cases: [string, number, string][] = [
      ['<= 0', 0, 'PASS'], ['<= 0', 1, 'FAIL'], ['>= 80', 80, 'PASS'], ['>= 80', 79.9, 'FAIL'],
      ['== 0', 0, 'PASS'], ['== 0', -1, 'FAIL'], ['< 10', 9, 'PASS'], ['< 10', 10, 'FAIL'], ['> 1.5', 1.6, 'PASS'], ['> 1.5', 1.5, 'FAIL'],
    ];
    for (const [target, value, result] of cases) {
      const check = one(target, observed(value));
      expect(check.result, `${value} ${target}`).toBe(result);
      expect(check.id).toBe('quality:PQ-900');
      expect(check.evidence).toEqual(['report:sha256:a']);
    }
  });

  it('[REQ-313] 最低サンプル数に満たない観測は不足にし、measure の値を defaults より優先する', () => {
    expect(one('== 0', observed(0, { samples: 2 }), 3).result).toBe('INSUFFICIENT_EVIDENCE');
    expect(one('== 0', observed(0, { samples: 2 }), 3).reason).toContain('2/3');
    expect(one('== 0', observed(0, { samples: 3 }), 3).result).toBe('PASS');
    expect(one('== 0', observed(0, { samples: undefined }), 3).result).toBe('INSUFFICIENT_EVIDENCE');
    const withDefault = quality({ 'PQ-900': { characteristic: 'c', evidence: [measure('== 0')] } }, { defaults: { min_samples: 100 } });
    expect(evaluateQualityConditions(withDefault, [observed(0)])[0].result).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('[REQ-313] 未実施・取得不能・古い・適格性未確認・未照合・未完の集計・target なし・観測なしを不足にする', () => {
    for (const status of ['incomplete', 'not_run', 'unavailable', 'ineligible', 'stale', 'unverified'] as const) {
      // 未完の集計値や暫定の 0 からも PASS・FAIL を作らない
      for (const value of [0, 5]) expect(one('== 0', observed(value, { status })).result, `${status} ${value}`).toBe('INSUFFICIENT_EVIDENCE');
    }
    expect(one('== 0', undefined).result).toBe('INSUFFICIENT_EVIDENCE');
    expect(one('== 0', observed(Number.NaN)).result).toBe('INSUFFICIENT_EVIDENCE');
    expect(one('== 0', observed(Number.POSITIVE_INFINITY)).result).toBe('INSUFFICIENT_EVIDENCE');
    expect(evaluateQualityConditions(quality({ 'PQ-900': { characteristic: 'c', evidence: [measure(undefined)] } }), [observed(0)])[0].result).toBe('INSUFFICIENT_EVIDENCE');
    expect(evaluateQualityConditions(quality({ 'PQ-900': { characteristic: 'c', evidence: [measure('== 0')] } }), [observed(0), observed(0)])[0].result).toBe('INSUFFICIENT_EVIDENCE');
    expect(evaluateQualityConditions(quality({ 'PQ-900': { characteristic: 'c', evidence: [measure('== 0')] } }), [observed(0, { subject: 'PQ-901' })])[0].result).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('[REQ-313] 合格証拠が空の対象と、参考指標だけを満たす対象を PASS にしない', () => {
    const q = quality({
      'PQ-001': { characteristic: 'c' },
      'PQ-002': { characteristic: 'c', indicators: [measure('== 0')] },
    });
    const checks = evaluateQualityConditions(q, [observed(0, { subject: 'PQ-002' })]);
    expect(checks.map((c) => c.result)).toEqual(['INSUFFICIENT_EVIDENCE', 'INSUFFICIENT_EVIDENCE']);
  });

  it('[REQ-313] 適格な必須条件の違反と別の不足が同時にあれば FAIL を優先し、blocking: false でも違反を相殺しない', () => {
    for (const blocking of [true, false]) {
      const q = quality({ 'PQ-900': { characteristic: 'c', blocking, evidence: [measure('== 0'), { source: 'ci.coverage', metric: 'coverage_line', target: '>= 80' }] } });
      const check = evaluateQualityConditions(q, [observed(2)])[0];
      expect(check.result).toBe('FAIL');
      expect(check.reason).toContain('満たしません');
    }
  });

  it('[REQ-313] 理由と確認者のある対象外は NOT_APPLICABLE にし、理由を残す', () => {
    const q = quality({ 'PQ-040': { characteristic: 'compatibility', applicability: 'not_applicable', reason: '同居しない', confirmed_by: 'r' } });
    expect(evaluateQualityConditions(q, [])).toEqual([{ id: 'quality:PQ-040', result: 'NOT_APPLICABLE', reason: '対象外：同居しない（確認者：r）', evidence: ['quality:PQ-040'] }]);
    // スキーマを通らない値（理由のない対象外）を渡されても NA にしない
    const unchecked = { ...q, product: { 'PQ-040': { characteristic: 'c', applicability: 'not_applicable', evidence: [], indicators: [] } } } as unknown as Quality;
    expect(evaluateQualityConditions(unchecked, [])[0].result).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('[REQ-313] freeze した同じ入力を繰り返し渡しても、入力と順序を変えず同じ結果を返す', () => {
    const q = deepFreeze(quality({ 'PQ-900': { characteristic: 'c', evidence: [measure('== 0')] }, 'PQ-100': { characteristic: 'c', evidence: [measure('<= 1')] } }, { objectives: { 'UQ-001': { characteristic: 'c', evidence: [] } } }));
    const observations = deepFreeze([observed(0), observed(1, { subject: 'PQ-100' })]);
    const first = evaluateQualityConditions(q, observations);
    expect(first.map((c) => c.id)).toEqual(['quality:UQ-001', 'quality:PQ-900', 'quality:PQ-100']);
    expect(evaluateQualityConditions(q, observations)).toEqual(first);
  });
});

const check = (id: string, result: VerifyCheckV2['result']): VerifyCheckV2 => ({ id, result, reason: id, evidence: [] });

describe('集約値と件数の一貫性', () => {
  it('[REQ-314][REQ-306] FAIL・不足・PASS の順で集約し、件数と evaluated が checks と一致する', () => {
    const checks = [check('a', 'PASS'), check('b', 'FAIL'), check('c', 'INSUFFICIENT_EVIDENCE'), check('d', 'NOT_APPLICABLE'), check('e', 'PASS')];
    for (const order of [checks, [...checks].reverse(), [...checks, ...checks]]) {
      const result = summarizeVerifyChecks(order, 'ci');
      expect(result).toEqual({
        scope: 'ci', verdict: 'FAIL',
        summary: { fail: order.filter((c) => c.result === 'FAIL').length, insufficient: order.filter((c) => c.result === 'INSUFFICIENT_EVIDENCE').length, not_applicable: order.filter((c) => c.result === 'NOT_APPLICABLE').length, evaluated: order.length },
      });
    }
    expect(summarizeVerifyChecks([check('a', 'PASS'), check('c', 'INSUFFICIENT_EVIDENCE')], 'ci')).toMatchObject({ verdict: 'INSUFFICIENT_EVIDENCE' });
    expect(summarizeVerifyChecks([check('a', 'PASS'), check('d', 'NOT_APPLICABLE')], 'ci')).toMatchObject({ verdict: 'PASS' });
    for (const empty of [[], [check('d', 'NOT_APPLICABLE')]]) expect(summarizeVerifyChecks(empty, 'ci')).toMatchObject({ verdict: 'INSUFFICIENT_EVIDENCE' });
  });

  it('[REQ-314] local では不足を pending、FAIL を fail に数え、verdict を返さない', () => {
    const local = summarizeVerifyChecks([check('a', 'PASS'), check('d', 'NOT_APPLICABLE'), check('c', 'INSUFFICIENT_EVIDENCE'), check('b', 'FAIL')], 'local');
    expect(local).toEqual({ scope: 'local', summary: { fail: 1, insufficient: 1, not_applicable: 1, evaluated: 4, pending: 1 } });
    expect(local).not.toHaveProperty('verdict');
    expect(summarizeVerifyChecks([check('a', 'PASS'), check('d', 'NOT_APPLICABLE')], 'local').summary).toMatchObject({ pending: 0, fail: 0 });
  });

  it('[REQ-314] quality:subjects は対象 0・全 NA・証拠の定義なしを不足にし、ゲートの PASS で相殺せず evaluated に数える', () => {
    const na = { characteristic: 'c', applicability: 'not_applicable' as const, reason: 'r', confirmed_by: 'p' };
    for (const q of [quality({}), quality({ 'PQ-001': na }), quality({ 'PQ-001': { characteristic: 'c' } })]) {
      const guard = qualitySubjectsGuard(q);
      expect(guard).toMatchObject({ id: 'quality:subjects', result: 'INSUFFICIENT_EVIDENCE' });
      const checks = [check('gate:requirements', 'PASS'), check('gate:test-command', 'PASS'), guard, ...evaluateQualityConditions(q, [])];
      const summarized = summarizeVerifyChecks(checks, 'ci');
      expect(summarized).toMatchObject({ verdict: 'INSUFFICIENT_EVIDENCE' });
      expect(summarized.summary.evaluated).toBe(checks.length);
    }
    expect(qualitySubjectsGuard(quality({ 'PQ-900': { characteristic: 'c', evidence: [measure('== 0')] }, 'PQ-001': na }))).toEqual({
      id: 'quality:subjects', result: 'PASS', reason: '合格に必要な証拠を定義した品質の対象：1 件', evidence: ['quality:PQ-900'],
    });
  });

  it('[REQ-314] decision は品質判定と独立に保持し、要判断と FAIL が同時なら両方が結果に残る', () => {
    const checks = [check('quality:PQ-900', 'FAIL'), check('quality:subjects', 'PASS')];
    const summarized = summarizeVerifyChecks(checks, 'ci');
    if (summarized.scope !== 'ci') throw new Error('ci の集約ではありません');
    const decision = { required: true, reasons: [{ code: 'CRITERIA_RELAXATION' as const, target: 'quality.yaml', message: '基準の緩和を検知しました' }] };
    const result = verifyResultV2Schema.parse({ schemaVersion: '2.0.0', change: 'c1', run: { status: 'completed', errors: [] }, scope: 'ci', checks, summary: summarized.summary, decision, verdict: summarized.verdict });
    expect(result).toMatchObject({ verdict: 'FAIL', decision, summary: { fail: 1 } });
    expect(verifyExitCode(result)).toBe(1);
    expect(summarizeVerifyChecks(checks, 'ci')).toEqual(summarized);
  });

  it('[REQ-310][REQ-314] 最小の quality.yaml（対象なし）は、完了ゲートの PASS にならない', () => {
    const q = quality({});
    const checks = [check('gate:requirements', 'PASS'), qualitySubjectsGuard(q), ...evaluateQualityConditions(q, [])];
    expect(summarizeVerifyChecks(checks, 'ci')).toMatchObject({ verdict: 'INSUFFICIENT_EVIDENCE' });
    expect(summarizeVerifyChecks(checks, 'local').summary).toMatchObject({ pending: 1 });
  });
});
