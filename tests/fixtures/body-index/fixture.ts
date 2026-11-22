import { createHash } from 'node:crypto';
import type { BodyReceipt, QualityEvidencePolicy } from '../../../packages/core/src/index.js';
import { summaryFixture } from '../../../packages/trace/test/summary-fixture.js';

export const hash = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
export const summaryPath = '.loomake/evidence/sample/20261106T000000Z-aaaaaaaaaaaa.json';
export const policy: QualityEvidencePolicy = { artifact_retention: '90d', long_term_store: 'manual', long_term_retention: '5y', access: 'project-members', delete_policy: 'never' };
export const now = '2026-11-07T00:00:00Z';
export function receiptFixture() {
  const body = Buffer.from('{"report":"本体"}\n');
  const summary = summaryFixture();
  summary.ci = { runId: '123', runAttempt: '1', source: 'environment' };
  summary.execution.origin = 'github-actions';
  summary.artifacts = [{ kind: 'test-report', path: 'report.json', sha256: hash(body), bytes: body.length,
    sameRun: { status: 'unverified', reason: '生成元は未確認です' }, counts: null, location: null,
    availability: 'not-uploaded', expiresAt: null, retrieval: null }];
  summary.gaps = summary.gaps.filter((g) => !['ci', 'artifacts'].includes(g.field));
  for (const key of ['counts', 'location', 'expiresAt', 'retrieval']) summary.gaps.push({ field: `artifacts[0].${key}`, kind: 'unverified', reason: '未確認です' });
  const summaryBytes = Buffer.from(JSON.stringify(summary) + '\n');
  const receipt: BodyReceipt = {
    indexVersion: 1, body: { kind: 'test-report', sha256: hash(body), bytes: body.length },
    summary: { path: summaryPath, sha256: hash(summaryBytes), bytes: summaryBytes.length, change: 'sample', sha: summary.sha,
      ci: { runId: '123', runAttempt: '1' } },
    locator: { type: 'github-actions-artifact', repository: 'owner/repository', artifactId: '456', artifactName: 'evidence-body', entry: 'test-report.json', runId: '123', runAttempt: '1' },
    archive: { sha256: 'c'.repeat(64), bytes: 100, apiDigest: `sha256:${'c'.repeat(64)}` },
    execution: { checkoutSha: summary.sha, workflowHeadSha: 'd'.repeat(40), runId: '123', runAttempt: '1' },
    artifact: { createdAt: '2026-11-06T00:00:00Z', expiresAt: '2027-02-04T00:00:00Z' },
    retrieval: { retrievedAt: '2026-11-06T01:02:03.999Z', method: 'github-api-authenticated-read', accessPolicy: 'project-members', policyVerified: false },
    gaps: [{ field: 'retrieval.accessPolicy', kind: 'unverified', reason: '全閲覧者の権限は未確認です' }],
  };
  return { receipt, summary, summaryBytes, body };
}
export const receiptName = (receipt: BodyReceipt, stamp = '20261106T010203Z') => `${stamp}-${receipt.locator.artifactId}-${hash(receipt.locator.entry).slice(0, 8)}.json`;
export const receiptPath = (receipt: BodyReceipt, stamp?: string) => `.loomake/evidence/_index/body/${receipt.body.sha256}/${receiptName(receipt, stamp)}`;
