import type { VerifyResultV2Aborted, VerifyResultV2Ci, VerifyResultV2Local } from '../../src/index.js';

const checks = (): VerifyResultV2Ci['checks'] => [
  { id: 'gate:requirements', result: 'PASS', reason: '承認された仕様と一致', evidence: ['spec:trace.md'] },
  { id: 'quality:PQ-900', result: 'INSUFFICIENT_EVIDENCE', reason: '観測がありません', evidence: [] },
  { id: 'quality:PQ-901', result: 'NOT_APPLICABLE', reason: '対象外。確認者: 合成例', evidence: ['quality:PQ-901'] },
];

/** ci・completed の 2.0.0 の合成例 */
export function ciValue(): VerifyResultV2Ci {
  return {
    schemaVersion: '2.0.0', change: 'c1', run: { status: 'completed', errors: [] }, scope: 'ci', checks: checks(),
    summary: { fail: 0, insufficient: 1, not_applicable: 1, evaluated: 3 },
    decision: { required: false, reasons: [] }, verdict: 'INSUFFICIENT_EVIDENCE', coverage: { 'REQ-012': ['tests/a.test.ts'] },
  };
}

/** local・completed の 2.0.0 の合成例。verdict を持たない */
export function localValue(): VerifyResultV2Local {
  return {
    schemaVersion: '2.0.0', change: 'c1', run: { status: 'completed', errors: [] }, scope: 'local', checks: checks(),
    summary: { fail: 0, insufficient: 1, not_applicable: 1, evaluated: 3, pending: 1 },
    decision: { required: false, reasons: [] },
  };
}

/** aborted の 2.0.0 の合成例。change が確定しない usage の誤り */
export function abortedValue(): VerifyResultV2Aborted {
  return {
    schemaVersion: '2.0.0', change: null,
    run: { status: 'aborted', errors: [{ kind: 'usage', target: '../x', message: 'change-id の形が正しくありません', next: '--change に change 名を指定してください' }] },
  };
}
