import { describe, expect, it } from 'vitest';
import * as core from '@loomake/core';
import * as kit from '../src/index.js';
import type { AgreementDecision, TestCoverageDecision } from '../src/index.js';

// @ts-expect-error REQ-148: 判定の結果型はcoreから公開しない。
import type { AgreementDecision as RemovedAgreementDecision } from '@loomake/core';
// @ts-expect-error REQ-149: 判定の結果型はcoreから公開しない。
import type { TestCoverageDecision as RemovedTestCoverageDecision } from '@loomake/core';

type Absent<T> = keyof T;
export type RemovedTypes = Absent<RemovedAgreementDecision> | Absent<RemovedTestCoverageDecision>;

describe('判定の公開元', () => {
  it('[REQ-148] kitが合意判定を公開し、coreにはモデル変換を残す', () => {
    expect(core).not.toHaveProperty('evaluateAgreement');
    const model = core.createAgreement('trace.md', { ledger: [], questions: [], assumptions: [] }).value;
    const result: AgreementDecision = kit.evaluateAgreement(model);
    expect(result).toEqual({ blockingQuestions: [], pendingRequirements: [], unapprovedAssumptions: [], missingSources: [] });
    expect(kit.evaluateAgreement(model)).toEqual(result);
  });

  it('[REQ-149] kitがテスト対応判定を公開する', () => {
    expect(core).not.toHaveProperty('evaluateTestCoverage');
    const result: TestCoverageDecision = kit.evaluateTestCoverage(['REQ-149'], {});
    expect(result).toEqual({ coverage: { 'REQ-149': [] }, missing: ['REQ-149'] });
    expect(kit.evaluateTestCoverage(['REQ-149'], {})).toEqual(result);
  });
});
