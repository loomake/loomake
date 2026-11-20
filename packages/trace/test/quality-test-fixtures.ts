import { loadQualitySchema, loadQualityReportSchema, type Quality } from '@loomake/core';
import { buildQualityEvaluation, type QualityEvaluation } from '../src/quality-model.js';
import { validateQualityLedgers, type FailedAttempt, type RequestEvent } from '../src/quality-ledger.js';

export const schema = (await loadQualitySchema()).qualitySchema;
export const reportSchema = (await loadQualityReportSchema()).qualityReportSchema;
export const at = '2026-11-05T12:00:00.000Z';
export const commit = 'a'.repeat(40), hash = 'b'.repeat(64);
export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const target = { commit, committedAt: at }, basis = { qualitySha256: hash, qualityVersion: 2 as const, model: 'iso-iec-25010-2011' };
export const quality = (): Quality => schema.parse({ version: 2, model: basis.model, product: {
  'PQ-001': { characteristic: 'maintainability', blocking: true, evidence: [{ source: 'ci.test_report', metric: 'tests_failed', target: '== 0' }] },
} });
export function evaluation(n = 1, attempt = n, when = at): QualityEvaluation {
  return buildQualityEvaluation({ quality: quality(), observations: [{ subject: 'PQ-001', source: 'ci.test_report', metric: 'tests_failed', status: 'measured', value: 0 }],
    commands: [{ name: 'test', result: 'passed' }], runId: uuid(100 + n), attempt, evaluatedAt: when, evaluatorVersion: '0.0.0', target, basis,
    request: { id: uuid(n), requestedAt: at, source: 'manual-cli' } });
}
export const accepted = (n = 1, when = at): RequestEvent => ({ version: 1, event: 'accepted', requestId: uuid(n), at: when, source: 'manual-cli', pid: 42, target: { commit }, basis: { qualitySha256: hash } });
export const started = (n = 1, attempt = n, run = 100 + n): RequestEvent => ({ version: 1, event: 'started', requestId: uuid(n), at, runId: uuid(run), attempt });
export const event = (name: 'evaluated' | 'reevaluated' | 'failed', n = 1, attempt = n, run = 100 + n): RequestEvent => ({ version: 1, event: name, requestId: uuid(n), at, runId: uuid(run), attempt, ...(name === 'failed' ? { failure: 'timeout' as const } : {}) }) as RequestEvent;
export const failed = (n = 1, attempt = n): FailedAttempt => ({ version: 1, runId: uuid(100 + n), attempt, requestId: uuid(n), target: { commit }, basis: { qualitySha256: hash },
  startedAt: at, endedAt: at, detectedAt: at, result: 'failed', failure: 'timeout', summary: `reports/quality/requests.jsonl#${uuid(n)}` });
export const lines = (rows: readonly unknown[]) => rows.map((row) => `${JSON.stringify(row)}\n`).join('');
export const ledgers = (requests: RequestEvent[], history: QualityEvaluation[] = [], attempts: FailedAttempt[] = []) => validateQualityLedgers({ requests: lines(requests), history: lines(history), attempts: lines(attempts) });
