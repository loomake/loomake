import type { VerifyResultV2 } from '@loomake/core';

/**
 * verify 2.0.0 の結果から終了コードを選ぶ（REQ-309、要件定義 7.3 の終了コードの表）。上の条件ほど優先する。
 * 2：aborted で、原因が usage か config。3：それ以外の aborted。
 * 1：decision.required、ci の verdict が PASS 以外、local の pending か fail が 1 以上。0：それ以外。
 * local の 0 は「Draft PR を作ってよい」を表し、最終合格ではない
 */
export function verifyExitCode(result: VerifyResultV2): 0 | 1 | 2 | 3 {
  if (result.run.status === 'aborted') {
    return result.run.errors.some((e) => e.kind === 'usage' || e.kind === 'config') ? 2 : 3;
  }
  const evaluated = result as Exclude<VerifyResultV2, { run: { status: 'aborted' } }>;
  if (evaluated.decision.required) return 1;
  if (evaluated.scope === 'ci') return evaluated.verdict === 'PASS' ? 0 : 1;
  return evaluated.summary.pending > 0 || evaluated.summary.fail > 0 ? 1 : 0;
}
