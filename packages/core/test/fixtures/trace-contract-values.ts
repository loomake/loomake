import type { Evidence, Report } from '../../src/index.js';

export function evidenceValue(): Evidence {
  return { schemaVersion: 1, change: 'c1', sha: 'a'.repeat(40), committedAt: '2026-10-24T00:00:00Z', recordedAt: '2026-10-24T00:00:00Z', verify: { schemaVersion: '1.0.0', mode: 'done', change: 'c1', ok: true, results: [{ check: 'test', status: 'pass', detail: '' }], coverage: { 'REQ-012': ['tests/a.test.ts'] } } };
}

export function reportValue(): Report {
  return { schemaVersion: 2, change: 'c1', evidence: { recordedAt: '', sha: '', committedAt: '', ok: true, documents: false }, attention: { noPassingTests: [], pending: [], changedDocuments: [], failedChecks: [] }, rows: [{ id: 'REQ-012', source: '', state: '反映済', summary: '', requirements: [], tests: [], result: '合格（仕様との対応は未確認）' }], questions: [{ id: 'Q-01', question: '', answer: '', answeredBy: '', answeredAt: '' }], assumptions: [{ id: 'A-01', content: '', approval: '', approvedBy: '', approvedAt: '' }], warnings: [] };
}
