import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadTraceSchemas, type EvidenceV2, type LegacyEvidence, type VerifyResultV2, type VerifyResultV2Ci } from '@loomake/core';
import { formatReportMarkdown } from '../src/index.js';
import { HISTORY_WARNING, projectEvidence } from '../src/projection.js';
import { reportFromEvidence } from '../src/report.js';
import { readDocuments } from '../src/documents.js';
import { CHANGE, ledgerRow, traceMd, withProject } from '../../kit/test/project.js';
import { abortedValue, ciValue, localValue } from '../../core/test/fixtures/verify-v2-values.js';

const { reportSchema } = await loadTraceSchemas();
const base = { change: CHANGE, sha: '0123456789abcdef0123456789abcdef01234567', committedAt: '2026-10-23T09:00:00+09:00', recordedAt: '2026-10-23T01:00:00.000Z' };
const legacy = (ok = true, documents = true): LegacyEvidence => ({
  ...base, schemaVersion: 1,
  verify: { schemaVersion: '1.0.0', mode: 'done', change: CHANGE, ok, results: [{ check: 'command:test', status: ok ? 'pass' : 'fail', detail: '' }], coverage: { 'REQ-012': ['tests/x.test.ts'] } },
  ...(documents ? {} : { documents: undefined }),
});
const v2 = (verify: VerifyResultV2): EvidenceV2 => ({ ...base, schemaVersion: 2, verify: { ...verify, change: CHANGE } as VerifyResultV2 });
const ciPass = (): VerifyResultV2Ci => ({ ...ciValue(), verdict: 'PASS', checks: [ciValue().checks[0]], summary: { fail: 0, insufficient: 0, not_applicable: 0, evaluated: 1 } });

/** 一時プロジェクトの change で、証拠の記録からレポートを作る。documents を付けると保存した文書を持つ記録になる */
function report(evidence: LegacyEvidence | EvidenceV2, writing?: number, documents = true) {
  return withProject({ trace: traceMd({ ledger: [ledgerRow('REQ-012'), ledgerRow('REQ-013')] }) }, (root) => {
    const dir = join(root, 'openspec/changes', CHANGE);
    const withDocs = documents ? { ...evidence, documents: readDocuments(dir) } : { ...evidence, documents: undefined };
    const built = reportFromEvidence(dir, CHANGE, withDocs as LegacyEvidence | EvidenceV2, writing);
    expect(reportSchema.parse(built)).toEqual(built);
    expect(JSON.parse(JSON.stringify(built))).toEqual(built);
    return built;
  });
}

describe('新旧の証拠の Report 2 への投影', () => {
  it('[REQ-316] 旧 Evidence 1 は従来の行・ok・失敗した検査を保ち、書き出しの版が新しいときだけ履歴閲覧専用の警告を先頭に加える', () => {
    for (const documents of [true, false]) {
      for (const ok of [true, false]) {
        const current = report(legacy(ok), 1, documents);
        const later = report(legacy(ok), 2, documents);
        expect(current.warnings).toEqual([]);
        expect(later.warnings).toEqual([HISTORY_WARNING]);
        expect({ ...later, warnings: [] }).toEqual(current);
        expect(current.evidence.ok).toBe(ok);
        expect(current.attention.failedChecks).toEqual(ok ? [] : ['command:test']);
        expect(current.rows.map((r) => r.result)).toEqual([documents ? '合格' : '合格（仕様との対応は未確認）', '合格したテストなし']);
        expect(current.schemaVersion).toBe(2);
      }
    }
    const markdown = formatReportMarkdown(report(legacy(), 2));
    expect(markdown).toContain(`- ${HISTORY_WARNING}`);
  });

  it('[REQ-316] v2 の ci・PASS・要判断なしだけを ok にし、成功したテストの対応を写す', () => {
    const built = report(v2(ciPass()));
    expect(built.evidence.ok).toBe(true);
    expect(built.attention.failedChecks).toEqual([]);
    expect(built.warnings).toEqual([]);
    expect(built.rows.find((r) => r.id === 'REQ-012')).toMatchObject({ tests: ['tests/a.test.ts'], result: '合格' });
    expect(built.rows.find((r) => r.id === 'REQ-013')).toMatchObject({ tests: [], result: '合格したテストなし' });
  });

  it('[REQ-316] v2 の ci の FAIL・不足は ok にせず、FAIL と不足の検査を分けて理由を残す', () => {
    const verify: VerifyResultV2 = { ...ciValue(), verdict: 'FAIL', checks: [ciValue().checks[0], { id: 'quality:PQ-800', result: 'FAIL', reason: '違反', evidence: [] }, ciValue().checks[1]], summary: { fail: 1, insufficient: 1, not_applicable: 0, evaluated: 3 } };
    const built = report(v2(verify));
    expect(built.evidence.ok).toBe(false);
    expect(built.attention.failedChecks).toEqual(['quality:PQ-800', 'quality:PQ-900']);
    expect(built.warnings).toEqual(['証拠の記録：条件の違反を確かめた検査：quality:PQ-800', '証拠の記録：証拠が足りない検査：quality:PQ-900']);
    const insufficient = report(v2(ciValue()));
    expect(insufficient.evidence.ok).toBe(false);
    expect(insufficient.warnings).toEqual(['証拠の記録：証拠が足りない検査：quality:PQ-900']);
    const decided = report(v2({ ...ciPass(), decision: { required: true, reasons: [{ code: 'PROTECTED_PATH' as const, target: 'src/auth', message: '保護パスへの変更' }] } }));
    expect(decided.evidence.ok).toBe(false);
    expect(decided.warnings).toEqual(['証拠の記録：人の判断が必要です：保護パスへの変更（PROTECTED_PATH・src/auth）']);
  });

  it('[REQ-316] local の完了は ok にせず、最終 CI の合格を確かめていないことを警告し、失敗した検査を作らない', () => {
    const done: VerifyResultV2 = { ...localValue(), checks: [ciValue().checks[0]], summary: { fail: 0, insufficient: 0, not_applicable: 0, evaluated: 1, pending: 0 } };
    const built = report(v2(done));
    expect(built.evidence.ok).toBe(false);
    expect(built.attention.failedChecks).toEqual([]);
    expect(built.warnings).toEqual(['証拠の記録：ローカルの検査（scope: local）の結果です。最終 CI の合格は確認していません（未完了 0 件・不合格 0 件）']);
    const markdown = formatReportMarkdown(built);
    expect(markdown).not.toMatch(/最終.{0,4}合格です/);
    expect(markdown).toContain('最終 CI の合格は確認していません');
  });

  it('[REQ-316] aborted は ok にせず、存在しない checks や成功したテストを作らずに中止の理由を残す', () => {
    const built = report(v2(abortedValue()));
    expect(built.evidence.ok).toBe(false);
    expect(built.attention.failedChecks).toEqual([]);
    expect(built.rows.every((r) => r.tests.length === 0)).toBe(true);
    expect(built.attention.noPassingTests).toEqual(['REQ-012', 'REQ-013']);
    expect(built.warnings).toEqual(['証拠の記録：検査は中止されました（aborted）。品質の判定はなく、合格ではありません', '証拠の記録：実行エラー（usage）../x：change-id の形が正しくありません']);
  });

  it('[REQ-316] partial は実行エラーを示し、ほかの証拠の警告より先、合意の記録の警告より前に置く', () => {
    const errors = [{ kind: 'permission' as const, target: 'ci.test_report', message: '成果物を取得できません', next: '権限を確認する' }];
    const projection = projectEvidence(v2({ ...ciValue(), run: { status: 'partial', errors } }));
    expect(projection.warnings).toEqual(['証拠の記録：一部の証拠を取得できませんでした（partial）', '証拠の記録：実行エラー（permission）ci.test_report：成果物を取得できません', '証拠の記録：証拠が足りない検査：quality:PQ-900']);
    const withAgreement = withProject({ trace: traceMd({ questions: ['| Q-01 | REQ-012 | 質問 | A / B | A | no | A |'] }) }, (root) => {
      const dir = join(root, 'openspec/changes', CHANGE);
      return reportFromEvidence(dir, CHANGE, { ...v2(abortedValue()), documents: readDocuments(dir) });
    });
    expect(withAgreement.warnings.at(-1)).toMatch(/^Q-01：/);
    expect(withAgreement.warnings[0]).toMatch(/^証拠の記録：/);
  });

  it('[REQ-316] 投影は入力を変えず、旧証拠を新しい形へ書き換えない', () => {
    const input = Object.freeze(legacy());
    const before = JSON.stringify(input);
    projectEvidence(input, 2);
    expect(JSON.stringify(input)).toBe(before);
    expect(input.verify.schemaVersion).toBe('1.0.0');
  });
});
