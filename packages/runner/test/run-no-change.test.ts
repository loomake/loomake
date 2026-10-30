import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runRun, type RunSummary } from '@loomake/runner';
import { makeRepo, type Repo } from './helpers.js';

vi.setConfig({ testTimeout: 60_000 });
const impl = { write: { 'impl.txt': '実装\n' } };
const noChange = { output: 'LOOMAKE-NOCHANGE: 1.1 で済んでいます' };
const tasks = (repo: Repo) => readFileSync(join(repo.root, 'openspec/changes/c1/tasks.md'), 'utf8');
const log = (repo: Repo) => repo.git('log', '--format=%s', 'loomake/c1').split('\n');
const summary = (repo: Repo): RunSummary => {
  const base = join(repo.root, '.loomake/runs');
  const dir = readdirSync(base).find((name) => name !== '.gitignore')!;
  return JSON.parse(readFileSync(join(base, dir, 'summary.json'), 'utf8'));
};
async function run(repo: Repo, dryRun = false) {
  const out: string[] = [];
  const code = await runRun({ root: repo.root, changeId: 'c1', env: repo.env, interactive: false, fileExists: () => false, stdout: (text) => out.push(text), dryRun });
  return { code, stdout: out.join('\n') };
}
async function withRepo(fn: (repo: Repo) => Promise<void>) {
  const repo = makeRepo();
  try { await fn(repo); } finally { repo.cleanup(); }
}

describe('変更を残さないエンジン', () => {
  it.each([
    ['合図なし', { output: '権限がなく変更できませんでした' }],
    ['行頭でない合図', { output: '引用 LOOMAKE-NOCHANGE: 例' }],
    ['空の理由', { output: 'LOOMAKE-NOCHANGE: \t\n次の行' }],
    ['除外されたファイルだけ', { write: { '.loomake/test-report.json': '{}' } }],
  ])('[REQ-330] %sならタスクを完了にせずコミットなしで止まる', (_name, step) => withRepo(async (repo) => {
    repo.plan([step]);
    const r = await run(repo);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('エンジンが変更を残さずに終わりました');
    expect(r.stdout).toContain('01-output.json');
    expect(r.stdout).toContain('権限や環境');
    expect(r.stdout).toContain('tasks.md');
    expect(tasks(repo)).toContain('- [ ] 1.1');
    expect(log(repo)).toEqual(['init']);
    expect(repo.calls()).toHaveLength(1);
    expect(summary(repo).status).toBe('stopped');
    expect(summary(repo).remainingTasks[0]).toContain('1.1');
  }));

  it('[REQ-330][REQ-099] 変更不要の理由を表示しtasks.mdだけのコミット本文にも残す', () => withRepo(async (repo) => {
    repo.plan([impl, noChange]);
    const r = await run(repo);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('1.1 で済んでいます');
    const rev = repo.git('log', '--format=%H', '--grep', '^run(c1): 1.2', 'loomake/c1');
    expect(repo.git('diff-tree', '--no-commit-id', '--name-only', '-r', rev)).toBe('openspec/changes/c1/tasks.md');
    expect(repo.git('show', '-s', '--format=%B', rev)).toContain('1.1 で済んでいます');
    expect(tasks(repo)).toContain('- [x] 1.2');
  }));

  it('[REQ-330] 理由に含まれる既知の秘密情報の形式を表示とコミット本文で置換する', () => withRepo(async (repo) => {
    const token = 'sk-' + 'testonly'.repeat(4);
    repo.plan([impl, { output: `LOOMAKE-NOCHANGE: 確認済み ${token}` }]);
    const r = await run(repo);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('確認済み ***');
    expect(r.stdout).not.toContain(token);
    const body = repo.git('log', '--format=%B', '--grep', '^run(c1): 1.2', 'loomake/c1');
    expect(body).toContain('確認済み ***');
    expect(body).not.toContain(token);
  }));

  it('[REQ-330] 変更と合図があれば変更とtasks.mdを通常どおりコミットする', () => withRepo(async (repo) => {
    repo.plan([{ ...impl, output: 'LOOMAKE-NOCHANGE: 例' }, noChange]);
    const r = await run(repo);
    expect(r.code).toBe(0);
    const rev = repo.git('log', '--format=%H', '--grep', '^run(c1): 1.1', 'loomake/c1');
    expect(repo.git('diff-tree', '--no-commit-id', '--name-only', '-r', rev).split('\n')).toEqual(['impl.txt', 'openspec/changes/c1/tasks.md']);
  }));

  it('[REQ-330] 質問と合図が両方あれば質問で止まる', () => withRepo(async (repo) => {
    repo.plan([{ output: 'LOOMAKE-NOCHANGE: 不要\nLOOMAKE-QUESTION: 確認してください' }]);
    const r = await run(repo);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('エンジンが質問しました');
    expect(tasks(repo)).toContain('- [ ] 1.1');
    expect(log(repo)).toEqual(['init']);
  }));

  it('[REQ-330] dry-runのタスクの指示に合図と差分なし停止の決まりを含める', () => withRepo(async (repo) => {
    const r = await run(repo, true);
    expect(r.stdout).toContain('`LOOMAKE-NOCHANGE:`');
    expect(r.stdout).toContain('変更もこの行もなければ');
  }));

  it.each([['合図なし', {}], ['合図あり', noChange]])('[REQ-331][REQ-100] 直しが%sで変更なしなら再検証せず止まり直しの指示に合図の決まりを含めない', (_name, step) => withRepo(async (repo) => {
    repo.plan([{ write: { 'a.txt': 'a' } }, { write: { 'b.txt': 'b' } }, step]);
    const r = await run(repo);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('直しでエンジンが変更を残さずに終わりました');
    expect(repo.calls()).toHaveLength(3);
    expect(repo.calls()[2].prompt).not.toContain('`LOOMAKE-NOCHANGE:`');
    expect(tasks(repo)).toContain('- [ ] 3.1');
    expect(log(repo).filter((line) => line.includes('完了ゲートの直し'))).toEqual([]);
    expect(summary(repo).status).toBe('stopped');
    expect(readdirSync(join(repo.root, '.loomake/runs', readdirSync(join(repo.root, '.loomake/runs')).find((name) => name !== '.gitignore')!)).filter((name) => name.includes('-verify'))).toHaveLength(1);
  }));
});
