import type { QualityResult } from '@loomake/core';

/**
 * 評価済み入力を集約し、CI verdict の値だけを返す（REQ-306）。
 * NOT_APPLICABLE の理由・確認者、証跡適格性、個別条件は集約前に確認する。
 * この関数だけでは証跡適格性や完了ゲート全体の最終合格を判定しない。
 */
export function aggregateCiVerdict(results: readonly QualityResult[]): QualityResult {
  if (results.includes('FAIL')) return 'FAIL';
  if (results.includes('INSUFFICIENT_EVIDENCE')) return 'INSUFFICIENT_EVIDENCE';
  return results.includes('PASS') ? 'PASS' : 'INSUFFICIENT_EVIDENCE';
}
