import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// package のプロジェクトで動かす（vitest.config.ts）。globalSetup（tests/package-build.setup.ts）が pnpm -r build を流すので、
// scripts/pending-approvals.mjs が読む packages/core・kit の dist はここで必ずある。なければ skip せずに失敗する
const root = join(import.meta.dirname, '..');
const script = join(root, 'scripts/pending-approvals.mjs');
const base = mkdtempSync(join(tmpdir(), 'loomake pending '));
afterAll(() => rmSync(base, { recursive: true, force: true }));

const trace = ['# trace', '', '## 要件台帳', '', '| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |', '|---|---|---|---|---|---|', '', '## 確認事項', '',
  '| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |', '|---|---|---|---|---|---|---|---|---|',
  '| Q-01 | REQ-001 | 段階をどう決めるか | A / B | A | yes |  |  |  |', '| Q-02 | REQ-001 | 回答済み | A / B | A | yes | A | 利用者 | 2026-10-30 |', '',
  '## 仮定', '', '| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |', '|---|---|---|---|---|---|---|', ''].join('\n');

function git(cwd: string, ...args: string[]) {
  const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
}

describe('pending-approvals.mjs の CLI', () => {
  it('取得済みの JSONL・JSON と git の ref の trace.md から CSV を書き、0 で終わる', () => {
    for (const name of ['core', 'kit']) expect(existsSync(join(root, 'packages', name, 'dist/index.js')), `${name} の dist`).toBe(true);
    const repo = join(base, 'repo');
    mkdirSync(join(repo, 'openspec/changes/c1'), { recursive: true });
    mkdirSync(join(repo, 'openspec/changes/archive/2026-10-01-old'), { recursive: true });
    writeFileSync(join(repo, 'openspec/changes/c1/trace.md'), trace);
    writeFileSync(join(repo, 'openspec/changes/archive/2026-10-01-old/trace.md'), trace);
    git(repo, 'init', '-q');
    git(repo, 'add', '.');
    const env = { ...process.env, GIT_COMMITTER_DATE: '2026-10-30T12:00:00Z', GIT_AUTHOR_DATE: '2026-10-30T12:00:00Z' };
    const committed = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'x'], { cwd: repo, encoding: 'utf8', env });
    expect(committed.status, committed.stderr).toBe(0);

    const comments = join(base, 'comments.jsonl');
    writeFileSync(comments, [
      { login: 'rrr-www', body: '@rrr-www 判断を, "急ぎ"', created_at: '2026-10-30T00:00:00Z', html_url: 'https://example.invalid/c1', via_app: 'chatgpt-codex-connector' },
      { login: 'rrr-www', body: '@rrr-xxx 回答済み', created_at: '2026-10-29T00:00:00Z', html_url: 'https://example.invalid/c0', via_app: 'chatgpt-codex-connector' },
      { login: 'rrr-www', body: '了解', created_at: '2026-10-29T01:00:00Z', html_url: 'https://example.invalid/c00', via_app: null },
    ].map((c) => JSON.stringify(c)).join('\n') + '\n');
    const prs = join(base, 'prs.json');
    writeFileSync(prs, JSON.stringify([
      { number: 7, title: '題名', url: 'https://example.invalid/pr/7', body: '## 人の判断が必要な項目\n\n- リリースの判断\n', createdAt: '2026-10-31T00:00:00Z' },
      { number: 8, title: '題名', url: 'https://example.invalid/pr/8', body: '承認待ち\n## 人の判断が必要な項目\n\nなし\n', createdAt: '2026-10-31T00:00:00Z' },
    ]));
    const out = join(base, 'out.csv');
    const result = spawnSync(process.execPath, [script, comments, prs, out, 'HEAD'], { cwd: repo, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const lines = readFileSync(out, 'utf8').split('\n');
    expect(lines[0]).toBe('kind,source_url,title,asked_at_jst,waiting_hours');
    expect(lines.slice(1, -1).map((line) => line.replace(/,[0-9.]+$/, ''))).toEqual([
      'issue121,https://example.invalid/c1,"@rrr-www 判断を, ""急ぎ""",2026-10-30 09:00',
      'trace,https://github.com/loomake/loomake/blob/main/openspec/changes/c1/trace.md,c1: 段階をどう決めるか,2026-10-30 21:00',
      'pr,https://example.invalid/pr/7,#7 題名,2026-10-31 09:00',
    ]);
    expect(lines.at(-1)).toBe('');
  });

  it('引数が足りなければ非ゼロで終わる', () => {
    const result = spawnSync(process.execPath, [script], { cwd: base, encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('使い方');
  });
});
