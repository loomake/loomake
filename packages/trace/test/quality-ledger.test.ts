import { describe, expect, it } from 'vitest';
import { loadQualitySchema, loadQualityReportSchema, type Quality } from '@loomake/core';
import { observeStaticMetrics, sha256Hex, UsageError, type StaticMetricsReceipt } from '@loomake/kit';
import { buildQualityEvaluation, qualityEvaluationProblem, utcDayPeriod, type QualityEvaluation } from '../src/quality-model.js';
import { foldRequests, nextQualityAttempt, parseQualityLines, unresolvedQualityAttempts, validateQualityLedgers, requestEventProblem, failedAttemptProblem, QUALITY_FAILURES, type FailedAttempt, type RequestEvent } from '../src/quality-ledger.js';

const schema = (await loadQualitySchema()).qualitySchema;
const reportSchema = (await loadQualityReportSchema()).qualityReportSchema;
const at = '2026-11-05T12:00:00.000Z';
const commit = 'a'.repeat(40), hash = 'b'.repeat(64);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const target = { commit, committedAt: at }, basis = { qualitySha256: hash, qualityVersion: 2 as const, model: 'iso-iec-25010-2011' };
const quality = (): Quality => schema.parse({ version: 2, model: basis.model, product: {
  'PQ-001': { characteristic: 'maintainability', blocking: true, evidence: [{ source: 'ci.test_report', metric: 'tests_failed', target: '== 0' }] },
} });
function evaluation(n = 1, attempt = n, when = at): QualityEvaluation {
  return buildQualityEvaluation({ quality: quality(), observations: [{ subject: 'PQ-001', source: 'ci.test_report', metric: 'tests_failed', status: 'measured', value: 0 }],
    commands: [{ name: 'test', result: 'passed' }], runId: uuid(100 + n), attempt, evaluatedAt: when, evaluatorVersion: '0.0.0', target, basis,
    request: { id: uuid(n), requestedAt: at, source: 'manual-cli' } });
}
const accepted = (n = 1, when = at): RequestEvent => ({ version: 1, event: 'accepted', requestId: uuid(n), at: when, source: 'manual-cli', pid: 42, target: { commit }, basis: { qualitySha256: hash } });
const started = (n = 1, attempt = n, run = 100 + n): RequestEvent => ({ version: 1, event: 'started', requestId: uuid(n), at, runId: uuid(run), attempt });
const event = (name: 'evaluated' | 'reevaluated' | 'failed', n = 1, attempt = n, run = 100 + n): RequestEvent => ({ version: 1, event: name, requestId: uuid(n), at, runId: uuid(run), attempt, ...(name === 'failed' ? { failure: 'timeout' as const } : {}) }) as RequestEvent;
const failed = (n = 1, attempt = n): FailedAttempt => ({ version: 1, runId: uuid(100 + n), attempt, requestId: uuid(n), target: { commit }, basis: { qualitySha256: hash },
  startedAt: at, endedAt: at, detectedAt: at, result: 'failed', failure: 'timeout', summary: `reports/quality/requests.jsonl#${uuid(n)}` });
const lines = (rows: readonly unknown[]) => rows.map((row) => `${JSON.stringify(row)}\n`).join('');
const ledgers = (requests: RequestEvent[], history: QualityEvaluation[] = [], attempts: FailedAttempt[] = []) => validateQualityLedgers({ requests: lines(requests), history: lines(history), attempts: lines(attempts) });

function staticReceipt(): StaticMetricsReceipt {
  const text = JSON.stringify({ startTime: 1500, testResults: [{ name: 'unit.test.ts', status: 'passed', assertionResults: [{ fullName: 'one', status: 'passed' }] }] });
  return { producer: { name: 'vitest', version: '5.0.5' }, target: { before: commit, after: commit }, basis: { before: hash, after: hash },
    invocation: { startedAt: 1000, finishedAt: 2000, testCleared: true, coverageCleared: true }, commands: [{ name: 'test', result: 'passed' }],
    report: { path: '.loomake/test-report.json', text, sha256: sha256Hex(text) }, coverage: null };
}

describe('評価結果とPQ/UQの独立集約', () => {
  it('[REQ-431][REQ-432] C1実出力の製品品質を利用時品質の観測へ流用しない', () => {
    const q = quality(); q.objectives['UQ-001'] = { characteristic: 'effectiveness', blocking: true, evidence: [...q.product['PQ-001'].evidence], indicators: [] };
    const observations = observeStaticMetrics(q, staticReceipt(), { sha256Hex });
    const before = structuredClone({ q, observations });
    const report = buildQualityEvaluation({ ...evaluation(), quality: q, observations, evaluatorVersion: '0.0.0' });
    expect(report.subjects).toMatchObject([{ id: 'UQ-001', result: 'INSUFFICIENT_EVIDENCE' }, { id: 'PQ-001', result: 'PASS' }]);
    expect(report.summary).toMatchObject({ product: { verdict: 'PASS', pass: 1 }, usage: { verdict: 'INSUFFICIENT_EVIDENCE', insufficient: 1 }, blockingUnmet: ['UQ-001'] });
    expect(report.observations.every((observation) => observation.subject.startsWith('PQ-'))).toBe(true);
    expect({ q, observations }).toEqual(before);
    expect(reportSchema.parse(report)).toEqual(report);
    expect(() => buildQualityEvaluation({ ...evaluation(), quality: q, observations, evaluatorVersion: '0.0.0', basis: { ...basis, model: '違うモデル' } })).toThrow(UsageError);
  });
  it('[REQ-431] 未取得error_countをPASSや参考指標で相殺しない', () => {
    const q = quality(); q.product['PQ-001'].evidence = [{ source: 'ci.command.lint', metric: 'error_count', target: '== 0' }];
    q.product['PQ-001'].indicators = [{ source: 'ci.test_report', metric: 'tests_failed', target: '== 0' }];
    const observations = observeStaticMetrics(q, staticReceipt(), { sha256Hex });
    const report = buildQualityEvaluation({ ...evaluation(), quality: q, observations, evaluatorVersion: '0.0.0' });
    expect(report.summary.product.verdict).toBe('INSUFFICIENT_EVIDENCE'); expect(report.summary.blockingUnmet).toEqual(['PQ-001']);
    expect(report.observations).toEqual(expect.arrayContaining([expect.objectContaining({ metric: 'tests_failed', status: 'measured', value: 0 })]));
    expect(report.subjects[0].result).toBe('INSUFFICIENT_EVIDENCE');
  });
  it('[REQ-431] UQへ渡された静的観測も採用せず空の集約をPASSにしない', () => {
    const q = quality(); q.objectives['UQ-001'] = { characteristic: 'effectiveness', evidence: [...q.product['PQ-001'].evidence], indicators: [] };
    const report = buildQualityEvaluation({ ...evaluation(), quality: q, observations: [{ subject: 'UQ-001', source: 'ci.test_report', metric: 'tests_failed', status: 'measured', value: 0 }], evaluatorVersion: '0.0.0' });
    expect(report.observations).toEqual([]); expect(report.summary.usage.verdict).toBe('INSUFFICIENT_EVIDENCE');
    const empty = buildQualityEvaluation({ ...evaluation(), quality: schema.parse({ version: 2, model: basis.model }), observations: [], evaluatorVersion: '0.0.0' });
    expect(empty.summary).toMatchObject({ product: { verdict: 'INSUFFICIENT_EVIDENCE', total: 0 }, usage: { verdict: 'INSUFFICIENT_EVIDENCE', total: 0 } });
  });
  it('[REQ-432] 内部構造と集約の不整合を拒否し未知欄は捨てない', () => {
    const original = evaluation();
    for (const patch of [{ version: 2 }, { attempt: 0 }, { runId: 'x' }, { evaluatedAt: '2026-02-30T00:00:00.000Z' }, { evaluator: null }, { basis: {} }, { target: {} }, { request: {} }, { commands: [{ name: 'test', result: 'success' }] }, { observations: [{ status: 'measured' }] }, { subjects: [...original.subjects, ...original.subjects] }, { summary: { ...original.summary, blockingUnmet: ['PQ-001'] } }, { period: { ...original.period, start: at } }]) {
      expect(qualityEvaluationProblem({ ...original, ...patch }), JSON.stringify(patch)).toEqual(expect.any(String));
    }
    const value = JSON.parse(JSON.stringify(original).replace('"version":1', '"version":1,"__proto__":{"kept":true},"future":{"enabled":true}'));
    expect(qualityEvaluationProblem(value)).toBeUndefined();
    const parsed = parseQualityLines<QualityEvaluation>(lines([value]), qualityEvaluationProblem)[0];
    expect(Object.hasOwn(parsed, '__proto__')).toBe(true); expect(parsed.future).toEqual({ enabled: true });
    expect(JSON.stringify(parsed)).toContain('"__proto__":{"kept":true}');
  });
  it.each(['2026-12-31T23:59:59.999Z', '2027-01-01T00:00:00.000Z', '2028-02-29T13:00:00.000Z'])('[REQ-441][REQ-432] UTC暦日を使う: %s', (when) => {
    const period = utcDayPeriod(when); expect(period.start).toBe(`${when.slice(0, 10)}T00:00:00.000Z`);
    expect(Date.parse(period.end) - Date.parse(period.start)).toBe(86_400_000);
  });
});

describe('要求イベントと履歴の整合性', () => {
  it('[REQ-440] 行順で四状態へ導き、時刻や入力を変更しない', () => {
    const rows = [accepted(), started(), event('failed'), accepted(2), started(2), event('evaluated', 2), event('reevaluated', 1, 2, 102)];
    const before = structuredClone(rows); const states = foldRequests(rows);
    expect(states.get(uuid(1))?.state).toBe('evaluated'); expect(states.get(uuid(1))?.accepted.at).toBe(at);
    expect(states.get(uuid(1))?.last).toMatchObject({ event: 'reevaluated', runId: uuid(102), attempt: 2 }); expect(rows).toEqual(before);
    const backwards = [{ ...accepted(), at: '2026-11-06T00:00:00.000Z' }, started()];
    expect(foldRequests(backwards).get(uuid(1))?.state).toBe('running');
  });
  it('[REQ-440] 回復可能なfailed/abandonedと真の終端を区別する', () => {
    const lost: RequestEvent = { version: 1, event: 'abandoned', requestId: uuid(1), at, phase: 'running', detectedBy: uuid(2) };
    const unrecoverable: RequestEvent = { version: 1, event: 'unrecoverable', requestId: uuid(1), at, reason: 'head-changed' };
    expect(foldRequests([accepted(), started(), lost]).get(uuid(1))?.state).toBe('reevaluation-pending');
    expect(foldRequests([accepted(), started(), lost, unrecoverable]).get(uuid(1))?.state).toBe('unrecoverable');
    const cancelled: RequestEvent = { version: 1, event: 'cancelled', requestId: uuid(1), at, phase: 'running', signal: 'SIGINT' };
    expect(foldRequests([accepted(), started(), cancelled]).get(uuid(1))?.state).toBe('cancelled');
    expect(() => foldRequests([accepted(), started(), cancelled, event('reevaluated')])).toThrow(UsageError);
  });
  it('[REQ-440] 受付・開始・失敗・真の終端の重複と不正順序を拒否する', () => {
    for (const rows of [[started()], [accepted(), accepted()], [accepted(), started(), started()], [accepted(), event('evaluated')], [accepted(), started(), event('failed'), event('failed')], [accepted(), started(), event('evaluated'), event('evaluated')], [accepted(), started(), { ...event('failed'), attempt: 99 }], [accepted(), { ...started(), attempt: 0 }]]) {
      expect(() => foldRequests(rows)).toThrow(UsageError);
    }
    expect(requestEventProblem({ ...accepted(), event: 'mystery' })).toEqual(expect.any(String));
    expect(requestEventProblem({ ...accepted(), pid: 0 })).toEqual(expect.any(String));
  });
  it('[REQ-433][REQ-440] 改行・JSON・構造の壊れた台帳を修復しない', () => {
    for (const text of [JSON.stringify(accepted()), '\n', '{\n', '{}\n']) expect(() => parseQualityLines(text, requestEventProblem)).toThrow(UsageError);
    expect(parseQualityLines('', requestEventProblem)).toEqual([]);
    expect(parseQualityLines(lines([accepted()]), requestEventProblem)).toEqual([accepted()]);
  });
  it('[REQ-433][REQ-441] 同runIdの別attemptを残し、組の二重取り込みだけを拒否する', () => {
    const report1 = evaluation(), report2 = evaluation(2); report2.runId = report1.runId;
    const requests = [accepted(), started(), event('evaluated'), accepted(2), started(2, 2, 101), event('evaluated', 2, 2, 101)];
    expect(ledgers(requests, [report1, report2]).history).toHaveLength(2);
    expect(() => ledgers(requests, [report1, report1])).toThrow(/同じ実行ID/);
    expect(() => ledgers([accepted(), started()], [report1], [failed()])).toThrow(/同じ実行ID/);
    expect(() => ledgers([accepted(), started(), accepted(2), started(2, 1, 101)])).toThrow(/開始が重複/);
  });
  it('[REQ-441] 後の保存成功で失敗を解消し、失敗行と元の時刻を残す', () => {
    const attempt = failed(), report = evaluation(2);
    const input = [accepted(), started(), event('failed'), accepted(2), started(2), event('evaluated', 2), event('reevaluated', 1, 2, 102)];
    const result = ledgers(input, [report], [attempt]);
    expect(unresolvedQualityAttempts(result.attempts, result.history)).toEqual([]); expect(result.attempts).toEqual([attempt]);
    expect(result.states.get(uuid(1))?.accepted.at).toBe(at); expect(nextQualityAttempt(result.history, result.attempts, commit)).toBe(3);
    expect(unresolvedQualityAttempts([attempt], [{ ...report, basis: { ...basis, qualitySha256: 'c'.repeat(64) } }])).toEqual([attempt]);
    expect(unresolvedQualityAttempts([attempt], [{ ...report, attempt: 1 }])).toEqual([attempt]);
  });
  it.each(QUALITY_FAILURES)('[REQ-441] 失敗分類%sと終了時刻を検証する', (failure) => {
    const attempt = { ...failed(), failure, endedAt: failure === 'crashed' ? null : at };
    expect(failedAttemptProblem(attempt)).toBeUndefined();
    expect(failedAttemptProblem({ ...attempt, endedAt: failure === 'crashed' ? at : null })).toEqual(expect.any(String));
    expect(failedAttemptProblem({ ...attempt, summary: '別の要求' })).toEqual(expect.any(String));
  });
  it('[REQ-441] startedだけ、履歴後、失敗行後の途中停止を区別できる', () => {
    const rows = [accepted(), started()];
    expect(ledgers(rows).states.get(uuid(1))?.state).toBe('running');
    expect(ledgers(rows, [evaluation()]).history).toHaveLength(1);
    expect(ledgers(rows, [], [failed()]).attempts).toHaveLength(1);
    expect(() => ledgers([accepted(), started(), event('failed')])).toThrow(/失敗試行がありません/);
    expect(() => ledgers([accepted(), started(), event('evaluated')])).toThrow(/履歴と一致/);
  });
  it('[REQ-441][REQ-433] 同じUTC日の再試行と翌日を3行/2期間として保持する', () => {
    const reports = [evaluation(1, 1, '2026-11-05T12:00:00.000Z'), evaluation(2, 2, '2026-11-05T23:59:59.999Z'), evaluation(3, 3, '2026-11-06T00:00:00.000Z')];
    const rows = reports.flatMap((_, i) => [accepted(i + 1), started(i + 1), event('evaluated', i + 1)]);
    const parsed = ledgers(rows, reports); expect(parsed.history).toEqual(reports);
    expect(new Set(parsed.history.map((report) => report.period.start))).toHaveLength(2);
    expect(nextQualityAttempt(parsed.history, [], commit)).toBe(4);
  });
  it('[REQ-432][REQ-441] 既知の参照不整合を拒否し未知キーを判定に使わない', () => {
    const report = evaluation();
    for (const patch of [{ request: { ...report.request, id: uuid(2) } }, { request: { ...report.request, requestedAt: '2026-11-04T00:00:00.000Z' } }, { target: { ...target, commit: 'c'.repeat(40) } }, { basis: { ...basis, qualitySha256: 'd'.repeat(64) } }]) {
      expect(() => ledgers([accepted(), started()], [{ ...report, ...patch }])).toThrow(UsageError);
    }
    const result = ledgers([accepted(), started()], [{ ...report, requestId: 'unknown metadata' }]);
    expect(result.history[0].requestId).toBe('unknown metadata');
    const attempts = ledgers([accepted(), started()], [], [{ ...failed(), request: { irrelevant: true } }]);
    expect(attempts.attempts[0].request).toEqual({ irrelevant: true });
  });
});
