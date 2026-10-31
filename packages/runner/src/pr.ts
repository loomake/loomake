import { join } from 'node:path';
import { runExternal } from '@loomake/kit';
import { createInputReader, JSON_LIMITS, isAbortedResult, isVerifyResultV2, verifyExitCode } from '@loomake/kit';
import type { EvidenceV2 } from '@loomake/core';
import type { Evidence } from '@loomake/trace';
import { isWindows, quote } from './shell.js';


/** gh CLI があり、ログインしているか（REQ-116） */
export function ghLoggedIn(root: string, env: NodeJS.ProcessEnv): boolean {
  const r = runExternal('gh', ['auth', 'status'], { cwd: root, env, shell: isWindows });
  return !r.error && r.status === 0;
}

/** proposal.md から見出しの節を取り出す */
function section(md: string, heading: string): string {
  const m = md.match(new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
  return m ? m[1].trim() : '';
}

/** 完了ゲートの結果の行。1.0.0 と 2.0.0 を読む。2.0.0 の local の完了は最終 CI の合格と書かない */
function verifySummary(verify: Evidence['verify'] | EvidenceV2['verify']): { outcome: string; lines: string[]; coverage: Record<string, string[]> } {
  if (!isVerifyResultV2(verify)) {
    return {
      outcome: verify.ok ? '合格' : '不合格',
      lines: verify.results.map((r) => `- ${r.status === 'pass' ? '✔' : r.status === 'warn' ? '!' : '✖'} ${r.check}`),
      coverage: verify.coverage ?? {},
    };
  }
  if (isAbortedResult(verify)) return { outcome: '中止（実行エラー）', lines: [], coverage: {} };
  const icon = { PASS: '✔', FAIL: '✖', INSUFFICIENT_EVIDENCE: '?', NOT_APPLICABLE: '-' } as const;
  return {
    outcome: verifyExitCode(verify) !== 0 ? '不合格' : verify.scope === 'ci' ? '合格' : 'ローカルの項目はすべて完了（CI の最終合格は未確認）',
    lines: verify.checks.map((c) => `- ${icon[c.result]} ${c.id}`),
    coverage: verify.coverage ?? {},
  };
}

/** PR の本文（REQ-115） */
export function prBody(root: string, changeDir: string, evidencePath: string): string {
  const proposal = createInputReader().read(join(changeDir, 'proposal.md'));
  const evidence = JSON.parse(createInputReader(JSON_LIMITS).read(join(root, evidencePath))) as Evidence | EvidenceV2;
  const { outcome, lines, coverage } = verifySummary(evidence.verify);
  const cell = (s: string) => s.replace(/\|/g, '\\|');
  return [
    '## Why',
    '',
    section(proposal, 'Why'),
    '',
    '## What Changes',
    '',
    section(proposal, 'What Changes'),
    '',
    '## 完了ゲートの結果',
    '',
    outcome,
    '',
    ...lines,
    '',
    '## 要件ごとのテスト',
    '',
    '| 要件 | テストファイル |',
    '|---|---|',
    ...Object.entries(coverage)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, files]) => `| ${id} | ${files.map(cell).join('<br>')} |`),
    '',
    '## 証拠の記録',
    '',
    `\`${evidencePath}\``,
    '',
  ].join('\n');
}

function requestUrl(value: unknown): string {
  if (typeof value !== 'string' || value.trim() !== value) throw new Error('PRのURLが不正です');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('PRのURLが不正です'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !/^\/[^/]+\/[^/]+\/pull\/[1-9]\d*$/.test(url.pathname)) throw new Error('PRのURLが不正です');
  return url.href;
}

/** 同じリポジトリの同じ向き先のopen PRだけを、一意な場合に返す。 */
export function findOpenPr(root: string, env: NodeJS.ProcessEnv, pr: { base: string; head: string }): string | undefined {
  const args = ['pr', 'list', '--base', pr.base, '--head', pr.head, '--state', 'open', '--limit', '2', '--json', 'url,baseRefName,headRefName,isCrossRepository'];
  const result = runExternal('gh', args.map(quote), { cwd: root, env, shell: isWindows });
  if (result.error || result.status !== 0) throw new Error(`既存PRの検索に失敗しました（${(result.stderr || result.error?.message || '').trim()}）`);
  let rows: unknown;
  try { rows = JSON.parse(result.stdout); } catch { throw new Error('既存PRの検索結果を読み取れません'); }
  if (!Array.isArray(rows) || rows.length > 1) throw new Error('既存PRの検索結果が一意に決まりません');
  if (rows.length === 0) return undefined;
  const row: unknown = rows[0];
  if (typeof row !== 'object' || row === null || !('baseRefName' in row) || row.baseRefName !== pr.base || !('headRefName' in row) || row.headRefName !== pr.head || !('isCrossRepository' in row) || row.isCrossRepository !== false || !('url' in row)) throw new Error('既存PRのリポジトリかブランチが一致しません');
  return requestUrl(row.url);
}

/** gh pr create で PR を作り、URL を返す（REQ-116） */
export function createPr(root: string, env: NodeJS.ProcessEnv, pr: { base: string; head: string; title: string; bodyFile: string }): string {
  const args = ['pr', 'create', '--base', pr.base, '--head', pr.head, '--title', pr.title, '--body-file', pr.bodyFile];
  // PR の作成は push と同じく、1 操作の期限ではなく run の残り時間で止める（REQ-182）
  const r = runExternal('gh', args.map(quote), { cwd: root, env, shell: isWindows, untilDeadline: true });
  if (r.error || r.status !== 0) throw new Error(`gh pr create に失敗しました（${(r.stderr || r.error?.message || '').trim()}）`);
  return requestUrl(r.stdout.trim());
}
