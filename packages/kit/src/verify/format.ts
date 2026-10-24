import type { VerifyResult } from '@loomake/core';

const ICON = { pass: '✔', fail: '✖', warn: '!', skip: '-' } as const;

/** verify の結果を、人が読む文章にする。合格以外の検査は詳細を字下げして添える */
export function formatVerifyResult(result: VerifyResult): string {
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
