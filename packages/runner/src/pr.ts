import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Evidence } from '@loomake/trace';

const isWindows = process.platform === 'win32';
const quote = (a: string) => (isWindows ? `"${a.replace(/"/g, '""')}"` : a);

/** gh CLI があり、ログインしているか（REQ-116、add-run-pr の仮定 A-23） */
export function ghLoggedIn(root: string, env: NodeJS.ProcessEnv): boolean {
  const r = spawnSync('gh', ['auth', 'status'], { cwd: root, env, encoding: 'utf8', shell: isWindows });
  return !r.error && r.status === 0;
}

/** proposal.md から見出しの節を取り出す */
function section(md: string, heading: string): string {
  const m = md.match(new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
  return m ? m[1].trim() : '';
}

/** PR の本文（REQ-115、add-run-pr の仮定 A-22） */
export function prBody(root: string, changeDir: string, evidencePath: string): string {
  const proposal = readFileSync(join(changeDir, 'proposal.md'), 'utf8');
  const evidence = JSON.parse(readFileSync(join(root, evidencePath), 'utf8')) as Evidence;
  const coverage = evidence.verify.coverage ?? {};
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
    evidence.verify.ok ? '合格' : '不合格',
    '',
    ...evidence.verify.results.map((r) => `- ${r.status === 'pass' ? '✔' : r.status === 'warn' ? '!' : '✖'} ${r.check}`),
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

/** gh pr create で PR を作り、URL を返す（REQ-116） */
export function createPr(root: string, env: NodeJS.ProcessEnv, pr: { base: string; head: string; title: string; bodyFile: string }): string {
  const args = ['pr', 'create', '--base', pr.base, '--head', pr.head, '--title', pr.title, '--body-file', pr.bodyFile];
  const r = spawnSync('gh', args.map(quote), { cwd: root, env, encoding: 'utf8', shell: isWindows });
  if (r.error || r.status !== 0) throw new Error(`gh pr create に失敗しました（${(r.stderr || r.error?.message || '').trim()}）`);
  return r.stdout.trim();
}
