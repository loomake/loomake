import { describe, expect, it, vi } from 'vitest';
import { chmodSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findViolations, runRun } from '@loomake/runner';
import { withProcessBudget } from '@loomake/kit';
import { branchExists, git, gitConfig, isIgnored, readHead } from '../src/git.js';
import { engineBaseline } from '../src/guards.js';
import { CHANGE, fakeCli, makeRepo } from './helpers.js';

vi.setConfig({ testTimeout: 60_000 });

// Windows はコロンをファイル名に使えない。そこで実在する特殊文字名と、下の git 環境の実プロセス試験を使う。
const names = process.platform === 'win32'
  ? ['brackets[magic].test.ts']
  : ['brackets[magic].test.ts', ':(top)x.test.ts', ':(glob)x.test.ts', ':!x.test.ts', ':/x.test.ts'];

describe('git の名前をリテラルに扱うガード', () => {
  it.each(names)('[REQ-138][REQ-109] %j に skip を足しても検出と差分表示を回避できない', (file) => {
    const repo = makeRepo();
    try {
      repo.write(file, "it.skip('case', () => {});\n");
      const result = findViolations(repo.root, repo.env);
      expect(result.findings).toContainEqual({ file, reason: "skip・todo を足しました：it.skip('case', () => {});" });
      expect(result.diff).toContain("+it.skip('case', () => {});");
    } finally {
      repo.cleanup();
    }
  });

  it.each(names)('[REQ-138][REQ-109] %j のアサーションを消しても検出と差分表示を回避できない', (file) => {
    const repo = makeRepo();
    try {
      repo.write(file, "it('case', () => {\n  expect(answer()).toBe(42);\n});\n");
      repo.git('add', '-A');
      repo.git('commit', '-qm', 'assertion');
      repo.write(file, "it('case', () => {\n});\n");
      const result = findViolations(repo.root, repo.env);
      expect(result.findings).toContainEqual({ file, reason: 'テストの検査を減らしました' });
      expect(result.findings).toContainEqual({ file, reason: 'アサーションかテストを消すか書き換えました：expect(answer()).toBe(42);' });
      expect(result.diff).toContain('-  expect(answer()).toBe(42);');
    } finally {
      repo.cleanup();
    }
  });

  it('[REQ-138][REQ-109] pathspec を扱う git の経路へリテラル指定を渡し、tasks と証拠のパスをそのまま登録する', () => {
    const repo = makeRepo();
    const snapshot = join(repo.base, 'git-environment.jsonl');
    repo.env.LOOMAKE_TEST_GIT_ENV_SNAPSHOT = snapshot;
    repo.env.GIT_LITERAL_PATHSPECS = '0';
    repo.env.GIT_TERMINAL_PROMPT = '1';
    repo.env.GIT_GLOB_PATHSPECS = '1';
    repo.env.GIT_NOGLOB_PATHSPECS = '1';
    repo.env.GIT_ICASE_PATHSPECS = '1';
    const cli = fakeCli(repo, 'git', {
      when: '(()=>{fs.appendFileSync(process.env.LOOMAKE_TEST_GIT_ENV_SNAPSHOT,JSON.stringify({args,literal:process.env.GIT_LITERAL_PATHSPECS,prompt:process.env.GIT_TERMINAL_PROMPT,glob:process.env.GIT_GLOB_PATHSPECS,noglob:process.env.GIT_NOGLOB_PATHSPECS,icase:process.env.GIT_ICASE_PATHSPECS})+String.fromCharCode(10));return false;})()',
    });
    try {
      const evidence = `.loomake/evidence/${CHANGE}/evidence[one].json`;
      const tasks = `openspec/changes/${CHANGE}/tasks.md`;
      repo.write(evidence, '{}\n');
      git(repo.root, repo.env, ['add', '--', evidence, tasks]);
      expect(git(repo.root, repo.env, ['diff', '--cached', '--name-only', '-z'])).toContain(evidence);
      expect(isIgnored(repo.root, repo.env, '.loomake/test-report.json')).toBe(true);
      expect(isIgnored(repo.root, repo.env, evidence)).toBe(false);
      expect(branchExists(repo.root, repo.env, 'main')).toBe(true);
      expect(gitConfig(repo.root, repo.env, 'remote.origin.url')).toContain('origin.git');
      expect(readHead(repo.root, repo.env, true).branch).toBe('main');
      repo.write('package.json', JSON.stringify({ scripts: { test: 'node test.js' } }));
      findViolations(repo.root, repo.env);
      expect(engineBaseline(repo.root, repo.env).head.branch).toBe('main');
      git(repo.root, repo.env, ['checkout', '-q', '--orphan', 'empty']);
      expect(readHead(repo.root, repo.env, true).sha).toBe('');
      const calls = readFileSync(snapshot, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as { args: string[]; literal: string; prompt: string; glob: string; noglob: string; icase: string });
      expect(calls.length).toBeGreaterThanOrEqual(10);
      for (const call of calls) expect(call).toMatchObject({
        literal: call.args[0] === 'check-ignore' ? '0' : '1', prompt: '0', glob: '0', noglob: '0', icase: '0',
      });
      expect(calls.some((call) => call.args[0] === 'check-ignore')).toBe(true);
      expect(calls.some((call) => call.args[0] === 'show')).toBe(true);
      expect(calls.some((call) => call.args[0] === 'config' && call.args.includes('--list'))).toBe(true);
      expect(calls.some((call) => call.args[0] === 'rev-parse' && call.args.includes('--verify'))).toBe(true);
      expect(repo.env.GIT_LITERAL_PATHSPECS).toBe('0');
      expect(repo.env.GIT_TERMINAL_PROMPT).toBe('1');
      expect(repo.env.GIT_GLOB_PATHSPECS).toBe('1');
      expect(repo.env.GIT_NOGLOB_PATHSPECS).toBe('1');
      expect(repo.env.GIT_ICASE_PATHSPECS).toBe('1');
    } finally {
      cli.restore();
      repo.cleanup();
    }
  });

  it.each([
    ['commit', 'pre-commit', undefined], ['push', 'pre-push', undefined],
    ['commit', 'pre-commit', '0'], ['push', 'pre-push', '0'],
  ] as const)('[REQ-198] %s の既存 %s へ元の pathspec 環境 %j を渡す', (command, hook, setting) => {
    const repo = makeRepo();
    try {
      repo.write('hook-target.ts', 'export const answer = 42;\n');
      repo.git('add', '-A');
      repo.git('commit', '-qm', 'hook target');
      const snapshot = join(repo.base, 'hook-environment.jsonl');
      repo.env.HOOK_SNAPSHOT = snapshot;
      for (const key of ['GIT_LITERAL_PATHSPECS', 'GIT_GLOB_PATHSPECS', 'GIT_NOGLOB_PATHSPECS', 'GIT_ICASE_PATHSPECS']) {
        if (setting === undefined) delete repo.env[key];
        else repo.env[key] = setting;
      }
      repo.env.GIT_TERMINAL_PROMPT = '1';
      repo.write('.git/hooks/check-pathspec.mjs', `import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const names = spawnSync('git', ['ls-files', '--', '*.ts'], { encoding: 'utf8' });
appendFileSync(process.env.HOOK_SNAPSHOT, JSON.stringify({ files: names.stdout, status: names.status,
  pathspec: ['GIT_LITERAL_PATHSPECS', 'GIT_GLOB_PATHSPECS', 'GIT_NOGLOB_PATHSPECS', 'GIT_ICASE_PATHSPECS'].map(key => process.env[key] ?? null),
  prompt: process.env.GIT_TERMINAL_PROMPT }) + String.fromCharCode(10));
if (names.status !== 0 || !names.stdout.includes('hook-target.ts')) process.exit(1);
`);
      repo.write(`.git/hooks/${hook}`, '#!/bin/sh\nnode .git/hooks/check-pathspec.mjs\n');
      chmodSync(join(repo.root, `.git/hooks/${hook}`), 0o755);
      const args = command === 'commit' ? ['commit', '--allow-empty', '-qm', 'hook check'] : ['push', '-u', 'origin', 'main'];
      let failure: unknown;
      try { withProcessBudget({ timeoutMs: 30_000 }, () => git(repo.root, repo.env, args)); } catch (error) { failure = error; }
      const observed = JSON.parse(readFileSync(snapshot, 'utf8').trim()) as { files: string; status: number; pathspec: (string | null)[]; prompt: string };
      expect(observed.files).toContain('hook-target.ts');
      expect(observed.status).toBe(0);
      expect(observed.pathspec).toEqual(Array(4).fill(setting ?? null));
      expect(observed.prompt).toBe('0');
      expect(failure).toBeUndefined();
      expect(repo.env.GIT_TERMINAL_PROMPT).toBe('1');
    } finally {
      repo.cleanup();
    }
  });

  it('[REQ-138][REQ-109] アサーション削除で run が停止し、HEAD と未完了タスクを保つ', async () => {
    const repo = makeRepo();
    const file = process.platform === 'win32' ? 'brackets[magic].test.ts' : ':(top)x.test.ts';
    try {
      repo.write(file, "it('case', () => {\n  expect(answer()).toBe(42);\n});\n");
      repo.git('add', '-A');
      repo.git('commit', '-qm', 'assertion');
      const before = repo.git('rev-parse', 'HEAD');
      const tasks = readFileSync(join(repo.root, `openspec/changes/${CHANGE}/tasks.md`), 'utf8');
      repo.plan([{ write: { [file]: "it('case', () => {\n});\n" } }]);
      const out: string[] = [];
      const code = await runRun({ root: repo.root, changeId: CHANGE, env: repo.env, interactive: false,
        confirm: async () => false, stdout: (text) => out.push(text), fileExists: () => false });
      expect(code, out.join('\n')).toBe(1);
      expect(out.join('\n')).toContain(`${file}：アサーションかテストを消すか書き換えました`);
      expect(out.join('\n')).toContain('-  expect(answer()).toBe(42);');
      expect(repo.calls()).toHaveLength(1);
      expect(repo.git('rev-parse', 'HEAD')).toBe(before);
      expect(readFileSync(join(repo.root, `openspec/changes/${CHANGE}/tasks.md`), 'utf8')).toBe(tasks);
    } finally {
      repo.cleanup();
    }
  });

  it('[REQ-138] check-ignore は実名を判定し、pathspec の名前で別のファイルを選ばない', () => {
    const repo = makeRepo();
    try {
      // check-ignore は存在しない名前も判定するため、Windows でもコロンを含む引数を検証できる。
      repo.write('.gitignore', '/x.txt\n/plain.json\n/brackets[[]one].json\n/space name.json\n*ignored.json\n');
      const ignored = ['x.txt', 'plain.json', 'brackets[one].json', 'space name.json',
        ':(top)ignored.json', ':(glob)ignored.json', ':!ignored.json', ':/ignored.json'];
      const allowed = ['other.txt', 'brackets[two].json', ':(top)x.txt', ':(glob)x.txt', ':!x.txt', ':/x.txt'];
      repo.env.GIT_LITERAL_PATHSPECS = '1';
      repo.env.GIT_GLOB_PATHSPECS = '1';
      repo.env.GIT_NOGLOB_PATHSPECS = '1';
      repo.env.GIT_ICASE_PATHSPECS = '1';
      for (const file of ignored) expect(isIgnored(repo.root, repo.env, file), file).toBe(true);
      for (const file of allowed) expect(isIgnored(repo.root, repo.env, file), file).toBe(false);
    } finally {
      repo.cleanup();
    }
  });

  it.each(names)('[REQ-138][REQ-109] %j の skip で run が停止し、コミットとタスクを進めない', async (file) => {
    const repo = makeRepo();
    try {
      const before = repo.git('rev-parse', 'HEAD');
      repo.plan([{ write: { [file]: "it.skip('case', () => {});\n" } }]);
      const out: string[] = [];
      const code = await runRun({ root: repo.root, changeId: CHANGE, env: repo.env, interactive: false,
        confirm: async () => false, stdout: (text) => out.push(text), fileExists: () => false });
      expect(code, out.join('\n')).toBe(1);
      expect(out.join('\n')).toContain(`${file}：skip・todo を足しました`);
      expect(out.join('\n')).toContain("+it.skip('case', () => {});");
      expect(repo.calls()).toHaveLength(1);
      expect(repo.git('rev-parse', 'HEAD')).toBe(before);
      expect(readFileSync(join(repo.root, `openspec/changes/${CHANGE}/tasks.md`), 'utf8')).toContain('- [ ] 1.1');
    } finally {
      repo.cleanup();
    }
  });
});
