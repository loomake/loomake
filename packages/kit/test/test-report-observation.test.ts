import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { loadQualitySchema, type Quality } from '@loomake/core';
import { FAILED_SUBJECTS_METRIC, TEST_REPORT_SOURCE, evaluateQualityConditions, observeTestReport, type TestReportReceipt } from '../src/index.js';

const { qualitySchema } = await loadQualitySchema();

const quality = (target = '== 0', min_samples = 1, extra: object = {}): Quality =>
  qualitySchema.parse({
    version: 2,
    model: 'm',
    product: { 'PQ-900': { characteristic: 'c', evidence: [{ source: TEST_REPORT_SOURCE, metric: FAILED_SUBJECTS_METRIC, target, min_samples }] }, ...extra },
  });

const SHA = 'a'.repeat(40);
const START = 1_000_000;
const reportText = (tests: [string, string][], startTime: number | null = START + 10) =>
  JSON.stringify({ ...(startTime === null ? {} : { startTime }), testResults: [{ name: '/p/a.test.ts', assertionResults: tests.map(([fullName, status]) => ({ fullName, status })) }] });

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const options = { sha256Hex: sha256 };
const reportOf = (text: string, path = '.loomake/test-report.json') => ({ path, text, sha256: sha256(text) });

const receipt = (over: Partial<TestReportReceipt> = {}, tests: [string, string][] = [['[REQ-012] 成功', 'passed']]): TestReportReceipt => ({
  producer: { name: 'vitest', version: '5.0.5' },
  target: { before: SHA, after: SHA },
  basis: { before: 'b1', after: 'b1' },
  invocation: { startedAt: START, finishedAt: START + 100, clearedBefore: true },
  report: reportOf(reportText(tests)),
  required: ['REQ-012'],
  ...over,
});

const observe = (r: TestReportReceipt | null, q = quality()) => observeTestReport(q, r, options);
const status = (r: TestReportReceipt | null, q = quality()) => observe(r, q)[0].status;

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value)) deepFreeze(entry);
  }
  return value;
}

describe('ci.test_report の adapter', () => {
  it('[REQ-319] 照合が通ったレポートから、必須の要件のうち失敗したものの数とサンプル数を返し、PASS に判定できる', () => {
    const observations = observe(receipt());
    expect(observations).toEqual([
      {
        subject: 'PQ-900',
        source: TEST_REPORT_SOURCE,
        metric: FAILED_SUBJECTS_METRIC,
        status: 'measured',
        value: 0,
        samples: 1,
        evidence: [`report:sha256:${sha256(reportText([['[REQ-012] 成功', 'passed']]))}`, 'basis:sha256:b1', `target:${SHA}`, 'producer:vitest@5.0.5'],
      },
    ]);
    expect(evaluateQualityConditions(quality(), observations)[0].result).toBe('PASS');
  });

  it('[REQ-319] 必須の要件の失敗したテストを数え、違反を FAIL にする', () => {
    const r = receipt({ required: ['REQ-012', 'REQ-013'] }, [
      ['[REQ-012] 成功', 'passed'],
      ['[REQ-012] 失敗', 'failed'],
      ['[REQ-013] 失敗', 'failed'],
      ['[REQ-099] 必須でない失敗', 'failed'],
    ]);
    const [o] = observe(r);
    expect(o).toMatchObject({ status: 'measured', value: 2, samples: 3 });
    expect(evaluateQualityConditions(quality(), [o])[0].result).toBe('FAIL');
  });

  it('[REQ-319] skip・todo・pending は実施に数えず、実施したテストのない必須の要件があれば集計中（不足）にする', () => {
    const r = receipt({ required: ['REQ-012', 'REQ-013'] }, [
      ['[REQ-012] 成功', 'passed'],
      ['[REQ-013] skip', 'skipped'],
      ['[REQ-013] todo', 'todo'],
      ['[REQ-013] pending', 'pending'],
    ]);
    const [o] = observe(r);
    expect(o).toMatchObject({ status: 'incomplete', value: 0, samples: 1 });
    expect(o.detail).toContain('REQ-013');
    const check = evaluateQualityConditions(quality(), [o])[0];
    expect(check.result).toBe('INSUFFICIENT_EVIDENCE');
    expect(check.reason).toContain('REQ-013');
  });

  it('[REQ-319] 未実施の要件があっても、数えた失敗だけで上限の違反が確定するときは measured で返して FAIL を優先する', () => {
    const r = receipt({ required: ['REQ-012', 'REQ-013'] }, [['[REQ-012] 失敗', 'failed']]);
    expect(observe(r)[0]).toMatchObject({ status: 'measured', value: 1 });
    expect(observe(r, quality('<= 0'))[0].status).toBe('measured');
    expect(observe(r, quality('< 1'))[0].status).toBe('measured');
    expect(observe(r, quality('<= 1'))[0].status).toBe('incomplete');
    expect(observe(r, quality('>= 0'))[0].status).toBe('incomplete');
  });

  it('[REQ-319] 最低サンプル数に満たなければ不足にする', () => {
    const [o] = observe(receipt());
    expect(evaluateQualityConditions(quality('== 0', 2), [o])[0].result).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('[REQ-319] テストランナーと版を確かめられなければ適格性なしにする', () => {
    expect(status(receipt({ producer: null }))).toBe('ineligible');
    expect(status(receipt({ producer: { name: 'mocha', version: '10.0.0' } }))).toBe('ineligible');
    expect(status(receipt({ producer: { name: 'vitest', version: 'latest' } }))).toBe('ineligible');
    expect(status(receipt({ producer: { name: 'jest', version: '29.7.0' } }))).toBe('measured');
  });

  it('[REQ-319] 対象のコミットが取れなければ未照合、実行中に変われば古い証拠にする', () => {
    expect(status(receipt({ target: { before: null, after: SHA } }))).toBe('unverified');
    expect(status(receipt({ target: { before: SHA, after: null } }))).toBe('unverified');
    expect(status(receipt({ target: { before: SHA, after: 'b'.repeat(40) } }))).toBe('stale');
  });

  it('[REQ-319] 実行中に基準の hash が変われば古い証拠にする', () => {
    expect(status(receipt({ basis: { before: 'b1', after: 'b2' } }))).toBe('stale');
  });

  it('[REQ-319] 置き残したレポート（事前に消していない、開始時刻がない・実行の範囲外）を measured にしない', () => {
    expect(status(receipt({ invocation: { startedAt: START, finishedAt: START + 100, clearedBefore: false } }))).toBe('unverified');
    const base = receipt();
    const withStart = (startTime: number | null) => ({ ...base, report: reportOf(reportText([['[REQ-012] 成功', 'passed']], startTime)) });
    expect(status(withStart(null))).toBe('unverified');
    expect(status(withStart(START - 1))).toBe('stale');
    expect(status(withStart(START + 101))).toBe('stale');
    expect(status(withStart(START))).toBe('measured');
    expect(status(withStart(START + 100))).toBe('measured');
  });

  it('[REQ-319] レポートがなければ未実施、読めなければ未照合、receipt がなければ未実施、必須の要件がなければ取得不能にする', () => {
    expect(status(receipt({ report: null }))).toBe('not_run');
    expect(status(receipt({ report: reportOf('{', 'r.json') }))).toBe('unverified');
    expect(status(null)).toBe('not_run');
    expect(status(receipt({ required: [] }))).toBe('unavailable');
  });

  it('[REQ-319] レポートの hash が本文と一致しなければ未照合にする', () => {
    const base = receipt();
    const [observation] = observe({ ...base, report: { ...base.report!, sha256: 'f'.repeat(64) } });
    expect(observation.status).toBe('unverified');
    expect(observation.detail).toContain('hash');
  });

  it('[REQ-319] テストを実行できなかった（ファイル単位で failed、テストが 0 件の）ファイルがあれば、ほかが成功でも measured 0 にしない', () => {
    const text = JSON.stringify({
      startTime: START + 10,
      testResults: [
        { name: '/p/a.test.ts', status: 'passed', assertionResults: [{ fullName: '[REQ-012] 成功', status: 'passed' }] },
        { name: '/p/broken.test.ts', status: 'failed', message: 'SyntaxError: Unexpected token\n    at x', assertionResults: [] },
      ],
    });
    const [observation] = observe(receipt({ report: reportOf(text) }));
    expect(observation.status).toBe('unverified');
    expect(observation.detail).toBe('テストを実行できなかったファイルがあります（/p/broken.test.ts：SyntaxError: Unexpected token）');
    expect(evaluateQualityConditions(quality(), [observation])[0].result).not.toBe('PASS');
  });

  it('[REQ-319] ファイル単位で failed でも、テストがあればテストごとの結果で数える', () => {
    const text = JSON.stringify({
      startTime: START + 10,
      testResults: [{ name: '/p/a.test.ts', status: 'failed', assertionResults: [{ fullName: '[REQ-012] 失敗', status: 'failed' }] }],
    });
    expect(observe(receipt({ report: reportOf(text) }))[0]).toMatchObject({ status: 'measured', value: 1 });
  });

  it('[REQ-319] ほかの source・metric と対象外の項目には観測を作らない', () => {
    const q = qualitySchema.parse({
      version: 2,
      model: 'm',
      product: {
        'PQ-001': { characteristic: 'c', evidence: [{ source: 'ci.coverage', metric: 'line', target: '>= 80' }] },
        'PQ-002': { characteristic: 'c', evidence: [{ source: TEST_REPORT_SOURCE, metric: 'other', target: '== 0' }] },
        'PQ-003': { characteristic: 'c', applicability: 'not_applicable', reason: 'r', confirmed_by: 'u', evidence: [{ source: TEST_REPORT_SOURCE, metric: FAILED_SUBJECTS_METRIC, target: '== 0' }] },
        'PQ-004': { characteristic: 'c', indicators: [{ source: TEST_REPORT_SOURCE, metric: FAILED_SUBJECTS_METRIC, target: '== 0' }] },
      },
    });
    expect(observeTestReport(q, receipt(), options)).toEqual([]);
    expect(evaluateQualityConditions(q, observeTestReport(q, receipt(), options)).map((c) => c.result)).not.toContain('PASS');
  });

  it('[REQ-319] 入力を変えず、同じ入力に同じ結果を返す', () => {
    const q = deepFreeze(quality());
    const r = deepFreeze(receipt());
    const first = observeTestReport(q, r, options);
    expect(observeTestReport(q, r, options)).toEqual(first);
  });
});
