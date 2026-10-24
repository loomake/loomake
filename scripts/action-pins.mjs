// ワークフローの外部 Actions の参照を、.github/action-pins.json の記録と照合する（REQ-167）

/**
 * `owner/repo@sha` と `owner/repo/path@sha` の参照を調べる。SHA は 40 桁に限り、記録とはリポジトリ（owner/repo）と SHA で照合する。
 * 問題がなければ null、あれば理由を返す
 */
export function actionReferenceProblem(reference, pins) {
  const match = /^([\w.-]+\/[\w.-]+)(?:\/[\w./-]+)?@([a-f0-9]{40})$/.exec(reference);
  if (!match) return '完全なコミット SHA で固定していません';
  const [, repository, sha] = match;
  if (!pins.some((pin) => pin.repository === repository && pin.sha === sha && pin.ref === 'v4')) return '.github/action-pins.json に記録がありません';
  return null;
}
