import { describe, expect, it } from 'vitest';
import { loadQualitySchema, type Quality } from '@loomake/core';
import { sha256Hex } from '../src/verify/hash.js';
import { observeStaticMetrics, type StaticMetricsReceipt } from '../src/index.js';

const schema = (await loadQualitySchema()).qualitySchema;
const quality = (source = 'ci.test_report', metric = 'tests_failed'): Quality => schema.parse({
  version: 2, model: 'iso-iec-25010-2011',
  product: { 'PQ-001': { characteristic: 'maintainability', evidence: [{ source, metric, target: '== 0' }] } },
});
const payload = (path: string, value: unknown) => {
  const text = JSON.stringify(value);
  return { path, text, sha256: sha256Hex(text) };
};
const receipt = (): StaticMetricsReceipt => ({
  producer: { name: 'vitest', version: '5.0.5' },
  target: { before: 'a'.repeat(40), after: 'a'.repeat(40) },
  basis: { before: 'b'.repeat(64), after: 'b'.repeat(64) },
  invocation: { startedAt: 1000, finishedAt: 2000, testCleared: true, coverageCleared: true },
  commands: [{ name: 'test', result: 'failed' }, { name: 'lint', result: 'passed' }],
  report: payload('.loomake/test-report.json', { startTime: 1500, testResults: [{ name: 'x.test.ts', status: 'failed', assertionResults: [
    { fullName: 'success', status: 'passed' }, { fullName: 'failure', status: 'failed' }, { fullName: 'skip', status: 'pending' },
  ] }] }),
  coverage: payload('.loomake/coverage/coverage-summary.json', { total: {
    statements: { pct: 80, total: 10 }, branches: { pct: 50, total: 4 }, functions: { pct: 100, total: 2 }, lines: { pct: 80, total: 10 },
  } }),
});
const observe = (q = quality(), r: StaticMetricsReceipt | null = receipt()) => observeStaticMetrics(q, r, { sha256Hex });

describe('今回の品質コマンドからの静的指標', () => {
  it.each([['tests_total', 2], ['tests_failed', 1], ['tests_passed', 1]] as const)('[REQ-430] %s は実施したテストだけ数える', (metric, value) => {
    expect(observe(quality('ci.test_report', metric))).toMatchObject([{ status: 'measured', value, samples: 2 }]);
  });
  it.each([['statements_pct', 80, 10], ['branches_pct', 50, 4], ['functions_pct', 100, 2], ['lines_pct', 80, 10]] as const)('[REQ-430] %s は実出力の割合を使う', (metric, value, samples) => {
    expect(observe(quality('ci.coverage', metric))).toMatchObject([{ status: 'measured', value, samples }]);
  });
  it('[REQ-430] 未実施や前回のレポートを測定値にしない', () => {
    expect(observe(quality(), null)).toMatchObject([{ status: 'not_run' }]);
    const r = receipt(); r.invocation.testCleared = false;
    expect(observe(quality(), r)).toMatchObject([{ status: 'unverified' }]);
    r.invocation.testCleared = true;
    r.report = payload('report.json', { startTime: 999, testResults: [] });
    expect(observe(quality(), r)).toMatchObject([{ status: 'stale' }]);
  });
  it('[REQ-430] 版・対象・基準・本文の照合ができない値を使わない', () => {
    const r = receipt(); r.producer = { name: 'unknown', version: '5.0.5' };
    expect(observe(quality(), r)).toMatchObject([{ status: 'ineligible' }]);
    r.producer = { name: 'vitest', version: '5.0.5' }; r.target.after = 'c'.repeat(40);
    expect(observe(quality(), r)).toMatchObject([{ status: 'stale' }]);
    r.target.after = r.target.before; r.basis.after = 'd'.repeat(64);
    expect(observe(quality(), r)).toMatchObject([{ status: 'stale' }]);
    r.basis.after = r.basis.before; r.report!.sha256 = '0'.repeat(64);
    expect(observe(quality(), r)).toMatchObject([{ status: 'unverified' }]);
  });
  it('[REQ-430] 読込失敗のファイルや実施ゼロをゼロ失敗の成功にしない', () => {
    const r = receipt();
    r.report = payload('report.json', { startTime: 1500, testResults: [{ name: 'broken.test.ts', status: 'failed', assertionResults: [] }] });
    expect(observe(quality(), r)).toMatchObject([{ status: 'unverified' }]);
    r.report = payload('report.json', { startTime: 1500, testResults: [] });
    expect(observe(quality(), r)).toMatchObject([{ status: 'not_run' }]);
  });
  it('[REQ-430] 未取得やUnknownのカバレッジを未評価にする', () => {
    const r = receipt(); r.coverage = null;
    expect(observe(quality('ci.coverage', 'lines_pct'), r)).toMatchObject([{ status: 'unavailable' }]);
    r.coverage = payload('coverage-summary.json', { total: { lines: { pct: 'Unknown', total: 0 } } });
    expect(observe(quality('ci.coverage', 'lines_pct'), r)).toMatchObject([{ status: 'unavailable' }]);
  });
  it.each(['passed', 'failed'] as const)('[REQ-430] コマンド%sをエラー件数0または1へ代えない', (result) => {
    const r = receipt(); r.commands = [{ name: 'lint', result }];
    const [value] = observe(quality('ci.command.lint', 'error_count'), r);
    expect(value.status).toBe('unavailable'); expect(value).not.toHaveProperty('value');
  });
  it('[REQ-430] 未設定のコマンドと非対応指標は合格証拠を作らない', () => {
    expect(observe(quality('ci.command.typecheck', 'error_count'))).toMatchObject([{ status: 'not_run' }]);
    expect(observe(quality('ci.command.lint', 'nonzero_exit'))).toEqual([]);
    expect(observe(quality('telemetry', 'count'))).toEqual([]);
  });
  it('[REQ-430] PQの参考指標も重複せず記録しUQへ流用しない。入力も変えない', () => {
    const q = quality();
    q.product['PQ-001'].indicators = [...q.product['PQ-001'].evidence];
    q.objectives['UQ-001'] = { characteristic: 'efficiency', evidence: [...q.product['PQ-001'].evidence], indicators: [] };
    const r = receipt(); const before = structuredClone({ q, r });
    expect(observe(q, r)).toHaveLength(1);
    expect({ q, r }).toEqual(before);
  });
});
