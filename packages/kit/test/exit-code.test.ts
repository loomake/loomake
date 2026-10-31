import { describe, it, expect } from 'vitest';
import type { VerifyResultV2, VerifyRunError } from '@loomake/core';
import { verifyExitCode } from '../src/index.js';
import { abortedValue, ciValue, localValue } from '../../core/test/fixtures/verify-v2-values.js';

const aborted = (...kinds: VerifyRunError['kind'][]): VerifyResultV2 =>
  ({ ...abortedValue(), run: { status: 'aborted', errors: kinds.map((kind) => ({ kind, target: 'x', message: '失敗', next: '確認する' })) } });
const decision = { required: true, reasons: [{ code: 'CRITERIA_RELAXATION' as const, target: 'quality.yaml', message: '基準の緩和' }] };

describe('verify 2.0.0 の終了コード', () => {
  it('[REQ-309] aborted は usage・config なら 2、ほかの種別なら 3 で、品質の FAIL として扱わない', () => {
    expect(verifyExitCode(aborted('usage'))).toBe(2);
    expect(verifyExitCode(aborted('config'))).toBe(2);
    for (const kind of ['permission', 'tool', 'network', 'runtime'] as const) expect(verifyExitCode(aborted(kind)), kind).toBe(3);
    expect(verifyExitCode(aborted('runtime', 'config'))).toBe(2);
  });

  it('[REQ-309] 要判断・ci の FAIL と不足・local の未完了は 1、ci の PASS と local の完了は 0', () => {
    const ci = ciValue();
    expect(verifyExitCode({ ...ci, verdict: 'PASS' })).toBe(0);
    for (const verdict of ['FAIL', 'INSUFFICIENT_EVIDENCE', 'NOT_APPLICABLE'] as const) expect(verifyExitCode({ ...ci, verdict }), verdict).toBe(1);
    expect(verifyExitCode({ ...ci, verdict: 'PASS', decision })).toBe(1);
    expect(verifyExitCode({ ...ci, verdict: 'FAIL', decision })).toBe(1);
    expect(verifyExitCode({ ...ci, verdict: 'PASS', run: { status: 'partial', errors: aborted('permission').run.errors } })).toBe(0);
    const local = localValue();
    const summary = { ...local.summary, pending: 0, fail: 0 };
    expect(verifyExitCode({ ...local, summary })).toBe(0);
    expect(verifyExitCode({ ...local, summary: { ...summary, pending: 1 } })).toBe(1);
    expect(verifyExitCode({ ...local, summary: { ...summary, fail: 1 } })).toBe(1);
    expect(verifyExitCode({ ...local, summary, decision })).toBe(1);
  });

  it('[REQ-309] 入力を変えない', () => {
    const value = Object.freeze({ ...ciValue(), verdict: 'PASS' as const });
    expect(verifyExitCode(value)).toBe(0);
    expect(value.verdict).toBe('PASS');
  });
});
