import { EVIDENCE_SCHEMA_VERSION, type EvidenceV2, type LegacyEvidence, type VerifyResultV2 } from '@loomake/core';

/** 証拠の記録から、Report 2 の既存の欄へ写す値（REQ-316） */
export type EvidenceProjection = {
  /** Report の evidence.ok。v2 では ci・PASS・要判断なしのときだけ true */
  ok: boolean;
  /** Report の attention.failedChecks。v2 では FAIL と不足の check の ID を順に写す */
  failedChecks: string[];
  /** 要件 ID ごとの成功したテストのファイル。証拠にない対応は作らない */
  coverage: Record<string, string[]>;
  /** Report の warnings の先頭に置く、証拠についての警告 */
  warnings: string[];
};

const isV2 = (evidence: LegacyEvidence | EvidenceV2): evidence is EvidenceV2 => evidence.schemaVersion === 2;
const list = (ids: string[]) => ids.join('、');

/** 書き出しの版より古い証拠への警告（REQ-316）。閲覧だけに使い、合格の根拠にしない */
export const HISTORY_WARNING = '証拠の記録：旧形式（Evidence 1・verify 1.0.0）の履歴です。閲覧だけに使い、現在の合格の根拠にはしません';

function v2Warnings(verify: VerifyResultV2): string[] {
  const errors = verify.run.errors.map((e) => `証拠の記録：実行エラー（${e.kind}）${e.target ? `${e.target}：` : ''}${e.message}`);
  if (verify.run.status === 'aborted') return ['証拠の記録：検査は中止されました（aborted）。品質の判定はなく、合格ではありません', ...errors];
  const evaluated = verify as Exclude<VerifyResultV2, { run: { status: 'aborted' } }>;
  const ids = (result: string) => evaluated.checks.filter((c) => c.result === result).map((c) => c.id);
  const warnings: string[] = [];
  if (evaluated.scope === 'local') {
    warnings.push(`証拠の記録：ローカルの検査（scope: local）の結果です。最終 CI の合格は確認していません（未完了 ${evaluated.summary.pending} 件・不合格 ${evaluated.summary.fail} 件）`);
  }
  if (evaluated.run.status === 'partial') warnings.push('証拠の記録：一部の証拠を取得できませんでした（partial）', ...errors);
  if (ids('FAIL').length) warnings.push(`証拠の記録：条件の違反を確かめた検査：${list(ids('FAIL'))}`);
  if (ids('INSUFFICIENT_EVIDENCE').length) warnings.push(`証拠の記録：証拠が足りない検査：${list(ids('INSUFFICIENT_EVIDENCE'))}`);
  if (evaluated.decision.required) {
    warnings.push(`証拠の記録：人の判断が必要です：${evaluated.decision.reasons.map((r) => `${r.message}（${r.code}・${r.target}）`).join(' / ') || '理由の記載なし'}`);
  }
  return warnings;
}

/**
 * 証拠の記録を版ごとに読み、Report 2 の既存の欄へ投影する（REQ-316）。I/O を行わない。
 * Evidence 1 は従来どおり verify.ok と fail の検査を写し、書き出しの版（current）より古ければ履歴閲覧専用の警告を付ける。
 * Evidence 2 は ci・PASS・要判断なしのときだけ ok にし、local・aborted・不足を合格と表示しない
 */
export function projectEvidence(evidence: LegacyEvidence | EvidenceV2, current: number = EVIDENCE_SCHEMA_VERSION): EvidenceProjection {
  if (!isV2(evidence)) {
    const verify = evidence.verify;
    return {
      ok: verify.ok,
      failedChecks: verify.results.filter((r) => r.status === 'fail').map((r) => r.check),
      coverage: verify.coverage ?? {},
      warnings: evidence.schemaVersion < current ? [HISTORY_WARNING] : [],
    };
  }
  const verify = evidence.verify;
  if (verify.run.status === 'aborted') return { ok: false, failedChecks: [], coverage: {}, warnings: v2Warnings(verify) };
  const evaluated = verify as Exclude<VerifyResultV2, { run: { status: 'aborted' } }>;
  return {
    ok: evaluated.scope === 'ci' && evaluated.verdict === 'PASS' && !evaluated.decision.required,
    failedChecks: evaluated.checks.filter((c) => c.result === 'FAIL' || c.result === 'INSUFFICIENT_EVIDENCE').map((c) => c.id),
    coverage: evaluated.coverage ?? {},
    warnings: v2Warnings(verify),
  };
}
