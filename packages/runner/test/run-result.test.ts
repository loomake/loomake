import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runRun, type RunSummary } from '@loomake/runner';
import { CHANGE, makeRepo, type Repo } from './helpers.js';

vi.setConfig({ testTimeout: 60_000 });
const failure = { is_error: true, subtype: 'error_max_turns' };
const tasksPath = `openspec/changes/${CHANGE}/tasks.md`;
const runDir = (repo: Repo) => {
  const parent = join(repo.root, '.loomake/runs');
  return join(parent, readdirSync(parent).find((name) => name !== '.gitignore')!);
};
const summary = (repo: Repo): RunSummary => JSON.parse(readFileSync(join(runDir(repo), 'summary.json'), 'utf8'));
async function run(repo: Repo) {
  const out: string[] = [];
  const code = await runRun({ root: repo.root, changeId: CHANGE, env: repo.env, interactive: false, confirm: async () => false, stdout: (text) => out.push(text), fileExists: () => false });
  return { code, stdout: out.join('\n') };
}
async function withRepo(fn: (repo: Repo) => Promise<void>) {
  const repo = makeRepo();
  try { await fn(repo); } finally { repo.cleanup(); }
}

const expectPending = (repo: Repo, original: string) => {
  expect(repo.git('rev-parse', 'HEAD')).toBe(original);
  expect(repo.git('diff', '--cached', '--name-only')).toBe('');
  expect(readFileSync(join(repo.root, tasksPath), 'utf8')).toContain('- [ ] 1.1');
  expect(repo.calls()).toHaveLength(1);
  expect(repo.prs()).toEqual([]);
};

describe('終了コード0の異常な結果で止まる', () => {
  it('[REQ-340][REQ-099] 変更を未完了のまま作業ツリーに残し具体的な記録先を表示する', () => withRepo(async (repo) => {
    const original = repo.git('rev-parse', 'HEAD');
    repo.plan([{ write: { 'impl.txt': '途中\n' }, resultFields: failure, git: [['add', 'impl.txt']] }]);
    const result = await run(repo);
    expect(result.code).toBe(1);
    expectPending(repo, original);
    expect(readFileSync(join(repo.root, 'impl.txt'), 'utf8')).toBe('途中\n');
    const expectedPath = join(runDir(repo), '01-output.json');
    expect(result.stdout).toContain(expectedPath);
    expect(summary(repo)).toMatchObject({ status: 'stopped', doneTasks: [] });
    expect(summary(repo).remainingTasks).toHaveLength(3);
    expect(summary(repo).reason).toContain('error_max_turns');
    expect(summary(repo).reason).toContain(expectedPath);
  }));

  it('[REQ-340][REQ-112] 不正な削除の差分と承認案内を保ち結果の異常を理由の先頭にする', () => withRepo(async (repo) => {
    repo.write('tests/a.test.ts', 'original\n');
    repo.git('add', '-A'); repo.git('commit', '-qm', 'test fixture');
    const original = repo.git('rev-parse', 'HEAD');
    repo.plan([{ delete: ['tests/a.test.ts'], resultFields: failure }]);
    const result = await run(repo);
    expect(result.code).toBe(1);
    expectPending(repo, original);
    expect(existsSync(join(repo.root, 'tests/a.test.ts'))).toBe(false);
    expect(result.stdout).toContain('diff --git a/tests/a.test.ts');
    expect(result.stdout).toContain('承認');
    expect(summary(repo).reason).toMatch(/^エンジンが失敗の結果を返しました/);
    expect(summary(repo).reason).toContain('。不正な直し方を見つけました');
  }));

  it.each([
    { stdout: 'LOOMAKE-NOCHANGE: 済み\n' },
    { output: 'LOOMAKE-NOCHANGE: 済み', resultFields: failure },
  ])('[REQ-340][REQ-330] 異常な結果は変更不要の合図があってもタスクを終えない %j', (step) => withRepo(async (repo) => {
    const original = repo.git('rev-parse', 'HEAD'); repo.plan([step]);
    const result = await run(repo);
    expect(result.code).toBe(1); expectPending(repo, original);
    expect(result.stdout).not.toContain('変更不要としてタスクを完了にします');
    expect(summary(repo).reason).not.toContain('変更を残さずに終わりました');
    expect(summary(repo).reason).toContain(step.stdout ? '読めません' : '失敗');
    expect(summary(repo).reason).toContain(join(runDir(repo), '01-output.json'));
  }));

  it('[REQ-340][REQ-204] 非ゼロ終了では結果の異常より既存の終了理由を優先する', () => withRepo(async (repo) => {
    const original = repo.git('rev-parse', 'HEAD');
    repo.plan([{ write: { 'impl.txt': '途中' }, resultFields: failure, exitCode: 1 }]);
    const result = await run(repo);
    expect(result.code).toBe(1); expectPending(repo, original);
    expect(summary(repo).reason).toBe('エンジンが終了コード 1 で終わりました');
  }));

  it('[REQ-340][REQ-204] Git内部変更時は先にその理由を示しguardでstageしない', () => withRepo(async (repo) => {
    const original = repo.git('rev-parse', 'HEAD');
    repo.plan([{ write: { '.git/hooks/pre-commit': '#!/bin/sh\nexit 0\n', 'impl.txt': '途中' }, chmod: ['.git/hooks/pre-commit'], resultFields: failure }]);
    const result = await run(repo);
    expect(result.code).toBe(1); expectPending(repo, original);
    expect(summary(repo).reason).toMatch(/^エンジンが git の設定かフックを変えました/);
    expect(summary(repo).reason).toContain('エンジンが失敗の結果を返しました');
  }));

  it('[REQ-340][REQ-341] 秘密の置換でJSONとして読める形になっても元の出力で異常を判断する', () => withRepo(async (repo) => {
    const original = repo.git('rev-parse', 'HEAD');
    repo.plan([{ stdout: '{"result":"a","x":"-----BEGIN PRIVATE KEY-----"} {"y":"-----END PRIVATE KEY-----"}' }]);
    const result = await run(repo);
    expect(result.code).toBe(1); expectPending(repo, original);
    expect(summary(repo).reason).toContain('読めません');
    const stored = readFileSync(join(runDir(repo), '01-output.json'), 'utf8');
    expect(JSON.parse(stored)).toEqual({ result: 'a', x: '***' });
  }));

  it.each([
    { output: 'BODY_MARKER', resultFields: { ...failure, unknown: 'BODY_MARKER' } },
    { stdout: 'not-json-BODY_MARKER' },
  ])('[REQ-340] 異常な結果の本文と未知欄を停止理由に出さず出力の記録に残す %j', (step) => withRepo(async (repo) => {
    const original = repo.git('rev-parse', 'HEAD'); repo.plan([step]);
    const result = await run(repo);
    expect(result.code).toBe(1); expectPending(repo, original);
    expect(result.stdout).not.toContain('BODY_MARKER');
    expect(summary(repo).reason).not.toContain('BODY_MARKER');
    expect(summary(repo).reason).toContain(step.stdout ? '読めません' : 'error_max_turns');
    expect(summary(repo).reason).toContain(join(runDir(repo), '01-output.json'));
    expect(readFileSync(join(runDir(repo), '01-output.json'), 'utf8')).toContain('BODY_MARKER');
  }));

  it.each([
    { write: { 'impl.txt': '直した\n' }, resultFields: failure },
    { stdout: 'not-json' },
  ])('[REQ-340][REQ-100][REQ-331] 直しの結果が異常ならcommitと再gateを行わない %j', (step) => withRepo(async (repo) => {
    repo.plan([{ write: { 'a.txt': 'a' } }, { write: { 'b.txt': 'b' } }, step]);
    const result = await run(repo);
    expect(result.code).toBe(1);
    expect(repo.calls()).toHaveLength(3);
    expect(repo.git('log', '--format=%s')).not.toContain('完了ゲートの直し');
    expect(repo.git('diff', '--cached', '--name-only')).toBe('');
    expect(readFileSync(join(repo.root, tasksPath), 'utf8')).toContain('- [ ] 3.1');
    expect(summary(repo).doneTasks).toHaveLength(2);
    expect(summary(repo).remainingTasks).toHaveLength(1);
    expect(summary(repo).reason).toContain(join(runDir(repo), '03-output.json'));
    expect(summary(repo).reason).not.toContain('変更を残さずに終わりました');
    expect(readdirSync(runDir(repo)).filter((name) => name.includes('-verify'))).toHaveLength(1);
    if (step.write) expect(readFileSync(join(repo.root, 'impl.txt'), 'utf8')).toBe('直した\n');
    if (step.stdout) expect(summary(repo).reason).toContain('読めません');
    expect(repo.prs()).toEqual([]);
  }));
});

describe('正常な結果と部分完了の履歴を保つ', () => {
  it.each([
    { subtype: 'success', is_error: false },
    { type: 'assistant', subtype: 'success_partial', is_error: false, unknown: { value: 1 } },
    { result: '' },
  ])('[REQ-099][REQ-100][REQ-330] 正常な結果は従来どおりcommit・NoChange・完了ゲートへ進む %j', (resultFields) => withRepo(async (repo) => {
    repo.plan([
      { write: { 'impl.txt': 'completed' }, resultFields },
      { output: 'LOOMAKE-NOCHANGE: 検査済み', resultFields: { subtype: 'success_partial', is_error: false } },
    ]);
    const result = await run(repo);
    expect(result.code, result.stdout).toBe(0);
    expect(repo.calls()).toHaveLength(2);
    const tasks = readFileSync(join(repo.root, tasksPath), 'utf8');
    expect(tasks).toContain('- [x] 1.1');
    expect(tasks).toContain('- [x] 1.2');
    expect(tasks).toContain('- [x] 3.1');
    expect(repo.git('log', '--format=%s')).toContain('run(c1): 1.1');
    expect(repo.git('log', '--format=%s')).toContain('run(c1): 1.2');
    expect(summary(repo).status).toBe('completed');
  }));

  it('[REQ-099][REQ-340] 後続タスクが失敗の結果でも完了済みcommitを保つ', () => withRepo(async (repo) => {
    repo.plan([{ write: { 'a.txt': 'first' } }, { write: { 'b.txt': 'unfinished' }, resultFields: failure }]);
    const result = await run(repo);
    expect(result.code).toBe(1);
    expect(repo.calls()).toHaveLength(2);
    expect(summary(repo).doneTasks).toHaveLength(1);
    expect(summary(repo).reason).toContain(join(runDir(repo), '02-output.json'));
    expect(repo.git('log', '--format=%s')).toContain('run(c1): 1.1');
    expect(repo.git('log', '--format=%s')).not.toContain('run(c1): 1.2');
    const tasks = readFileSync(join(repo.root, tasksPath), 'utf8');
    expect(tasks).toContain('- [x] 1.1'); expect(tasks).toContain('- [ ] 1.2');
    expect(readFileSync(join(repo.root, 'b.txt'), 'utf8')).toBe('unfinished');
    expect(repo.git('diff', '--cached', '--name-only')).toBe('');
  }));

  it('[REQ-340][REQ-100][REQ-112] 直しで結果異常と禁止変更が重なっても差分と案内を表示する', () => withRepo(async (repo) => {
    repo.plan([{ write: { 'a.txt': 'a' } }, { write: { 'b.txt': 'b' } }, { write: { 'vitest.config.ts': 'export default {};\n' }, resultFields: failure }]);
    const result = await run(repo);
    expect(result.code).toBe(1);
    expect(repo.calls()).toHaveLength(3);
    expect(summary(repo).reason).toMatch(/^エンジンが失敗の結果を返しました/);
    expect(summary(repo).reason).toContain('。不正な直し方を見つけました');
    expect(result.stdout).toContain('diff --git a/vitest.config.ts');
    expect(result.stdout).toContain('承認');
    expect(repo.git('log', '--format=%s')).not.toContain('完了ゲートの直し');
    expect(repo.git('diff', '--cached', '--name-only')).toBe('');
    expect(readdirSync(runDir(repo)).filter((name) => name.includes('-verify'))).toHaveLength(1);
  }));
});
