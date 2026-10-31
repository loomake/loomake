import type { VerifyResult, VerifyResultV2, VerifyResultV2Aborted } from '@loomake/core';
import { verifyExitCode } from './exit-code.js';

const ICON = { pass: '✔', fail: '✖', warn: '!', skip: '-' } as const;
const ICON_V2 = { PASS: '✔', FAIL: '✖', INSUFFICIENT_EVIDENCE: '?', NOT_APPLICABLE: '-' } as const;

/** verify の結果が 2.0.0 か。1.0.0 は mode と results を持つ */
export const isVerifyResultV2 = (result: VerifyResult | VerifyResultV2): result is VerifyResultV2 => result.schemaVersion === '2.0.0';

/** 2.0.0 の結果が aborted か。aborted は checks・summary・decision・verdict を持たない */
export const isAbortedResult = (result: VerifyResultV2): result is VerifyResultV2Aborted => result.run.status === 'aborted';

/** verify の結果を、人が読む文章にする。合格以外の検査は詳細を字下げして添える。1.0.0 と 2.0.0 の両方を読む */
export function formatVerifyResult(result: VerifyResult | VerifyResultV2): string {
  if (isVerifyResultV2(result)) return formatV2(result);
  const failed = result.results.filter((r) => r.status === 'fail').length;
  const lines = [`Loomake verify  mode=${result.mode}${result.change ? `  change=${result.change}` : ''}`, ''];
  for (const r of result.results) {
    lines.push(`${ICON[r.status]} ${r.check}`);
    if (r.detail && r.status !== 'pass') lines.push(r.detail.replace(/^/gm, '    '));
  }
  const skipped = result.results.some((r) => r.check === '品質コマンド' && r.status === 'skip');
  lines.push('', `${failed === 0 ? '合格' : `不合格（${failed} 件）`}${skipped ? '（品質コマンドを実行していません）' : ''}`);
  return lines.join('\n');
}

// 2.0.0 の結果。local の完了は最終合格と呼ばない。aborted は実行エラーの種別・対象・次の操作を示す
function formatV2(result: VerifyResultV2): string {
  const lines = [`Loomake verify  ${isAbortedResult(result) ? 'aborted' : `scope=${result.scope}`}${result.change ? `  change=${result.change}` : ''}`, ''];
  if (isAbortedResult(result)) {
    for (const e of result.run.errors) lines.push(`✖ 実行エラー（${e.kind}）${e.target}`, `    ${e.message}`, `    次の操作：${e.next}`);
    lines.push('', `中止しました（実行エラー。終了コード ${result.run.errors.some((e) => e.kind === 'usage' || e.kind === 'config') ? 2 : 3}）`);
    return lines.join('\n');
  }
  for (const c of result.checks) {
    lines.push(`${ICON_V2[c.result]} ${c.id}`);
    if (c.reason && c.result !== 'PASS') lines.push(c.reason.replace(/^/gm, '    '));
  }
  for (const e of result.run.errors) lines.push(`! 実行エラー（${e.kind}）${e.target}：${e.message}`);
  const { fail } = result.summary;
  // local の未完了は pending、ci の不足は insufficient で数える
  const insufficient = result.scope === 'local' ? result.summary.pending : result.summary.insufficient;
  const short = result.scope === 'local' ? '未完了' : '証拠不足';
  const decision = result.decision.required ? `。人の判断が必要です：${result.decision.reasons.map((r) => r.message).join(' / ') || '理由の記載なし'}` : '';
  const passed = verifyExitCode(result) === 0;
  const verdict = fail ? `不合格（${fail} 件${insufficient ? `・${short} ${insufficient} 件` : ''}）`
    : insufficient ? `${short}（${insufficient} 件）`
      : result.decision.required ? '人の判断待ち'
        : !passed ? `不合格（${result.scope === 'ci' ? result.verdict : '未完了'}）`
          : result.scope === 'ci' ? '合格' : 'ローカルの項目はすべて完了（CI の最終合格ではありません）';
  lines.push('', `${verdict}${decision}`);
  return lines.join('\n');
}
