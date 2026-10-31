import type { EvidenceV2, LegacyEvidence, Report, VerifyResultV2Ci } from '../../src/index.js';
import { ciValue } from './verify-v2-values.js';

/** 履歴の Evidence 1（verify 1.0.0 を埋め込む） */
export function evidenceValue(): LegacyEvidence {
  return { schemaVersion: 1, change: 'c1', sha: 'a'.repeat(40), committedAt: '2026-10-24T00:00:00Z', recordedAt: '2026-10-24T00:00:00Z', verify: { schemaVersion: '1.0.0', mode: 'done', change: 'c1', ok: true, results: [{ check: 'test', status: 'pass', detail: '' }], coverage: { 'REQ-012': ['tests/a.test.ts'] } } };
}

/** いまの書き出しの Evidence 2（verify 2.0.0 を埋め込む） */
export function evidenceV2Value(): EvidenceV2 & { verify: VerifyResultV2Ci } {
  return { ...evidenceValue(), schemaVersion: 2, verify: ciValue() };
}

export function reportValue(): Report {
  return { schemaVersion: 2, change: 'c1', evidence: { recordedAt: '', sha: '', committedAt: '', ok: true, documents: false }, attention: { noPassingTests: [], pending: [], changedDocuments: [], failedChecks: [] }, rows: [{ id: 'REQ-012', source: '', state: '反映済', summary: '', requirements: [], tests: [], result: '合格（仕様との対応は未確認）' }], questions: [{ id: 'Q-01', question: '', answer: '', answeredBy: '', answeredAt: '' }], assumptions: [{ id: 'A-01', content: '', approval: '', approvedBy: '', approvedAt: '' }], warnings: [] };
}
