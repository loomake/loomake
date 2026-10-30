import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runRun } from '@loomake/runner';
import { CHANGE, makeRepo, noChange, type Repo } from './helpers.js';

// git・node・verify のコマンドを何度も起動するので、Windows では 1 件に 10 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

async function withPassingRun(fn: (repo: Repo, r: { code: number; stdout: string }) => void, setup?: (repo: Repo) => void) {
  const repo = makeRepo();
  try {
    setup?.(repo);
    repo.plan([{ write: { 'impl.txt': '実装\n' } }, noChange]);
    const out: string[] = [];
    const code = await runRun({
      root: repo.root,
      changeId: CHANGE,
      interactive: false,
      confirm: async () => false,
      stdout: (t) => out.push(t),
      env: repo.env,
      fileExists: () => false,
    });
    fn(repo, { code, stdout: out.join('\n') });
  } finally {
    repo.cleanup();
  }
}

const remoteHas = (repo: Repo, branch: string) =>
  spawnSync('git', ['--git-dir', join(repo.base, 'origin.git'), 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]).status === 0;

describe('証拠を記録してから PR を作る', () => {
  it('[REQ-114] 合格したら、証拠の記録をコミットし、ブランチを origin に送り、始めたブランチに向けた PR を作って終了コード 0 を返す', () =>
    withPassingRun((repo, r) => {
      expect(r.code).toBe(0);
      expect(r.stdout).toContain('PR を作りました：https://github.com/example/repo/pull/1');
      const evidence = readdirSync(join(repo.root, '.loomake/evidence', CHANGE));
      expect(evidence).toHaveLength(1);
      expect(repo.git('log', '--format=%s', '-1', 'loomake/c1')).toBe('evidence(c1): 証拠を記録する');
      expect(remoteHas(repo, 'loomake/c1')).toBe(true);
      const [pr] = repo.prs();
      expect(pr.args).toEqual(expect.arrayContaining(['pr', 'create', '--base', 'main', '--head', 'loomake/c1', '--title', 'c1']));
    }));

  it('[REQ-114] PR を作る時点で、ブランチの最後のコミットに証拠の記録が入っている', () =>
    withPassingRun((repo) => {
      const files = repo.git('show', '--name-only', '--format=', 'loomake/c1').split('\n');
      expect(files[0]).toMatch(/^\.loomake\/evidence\/c1\/\d{8}T\d{6}Z-[0-9a-f]{12}\.json$/);
      expect(repo.git('rev-parse', 'loomake/c1')).toBe(spawnSync('git', ['--git-dir', join(repo.base, 'origin.git'), 'rev-parse', 'loomake/c1'], { encoding: 'utf8' }).stdout.trim());
      const { snapshot } = repo.prs()[0];
      expect(snapshot).toBeDefined();
      expect(snapshot!.head).toBe(repo.git('rev-parse', 'loomake/c1'));
      expect(snapshot!.files).toContain(files[0]);
      expect(snapshot!.remoteHead).toBe(snapshot!.head);
    }, (repo) => { repo.env.FAKE_GH_SNAPSHOT = '1'; }));
});

const runOnce = async (repo: Repo) => {
  const out: string[] = [];
  const code = await runRun({
    root: repo.root,
    changeId: CHANGE,
    interactive: false,
    confirm: async () => false,
    stdout: (t) => out.push(t),
    env: repo.env,
    fileExists: () => false,
  });
  return { code, stdout: out.join('\n') };
};

describe('再開したときの PR の向き先', () => {
  it('[REQ-114] 止まったあと loomake/<change-id> の上で再開しても、最初に始めたブランチに向けた PR を作る', async () => {
    const repo = makeRepo();
    try {
      repo.plan([{ output: 'LOOMAKE-QUESTION: 続けますか' }, { write: { 'impl.txt': '実装\n' } }, noChange]);
      expect((await runOnce(repo)).code).toBe(1);
      expect(repo.git('rev-parse', '--abbrev-ref', 'HEAD')).toBe('loomake/c1');
      const r = await runOnce(repo);
      expect(r.code, r.stdout).toBe(0);
      expect(repo.prs()[0].args).toEqual(expect.arrayContaining(['--base', 'main', '--head', 'loomake/c1']));
    } finally {
      repo.cleanup();
    }
  });

  it('[REQ-114] 人が作った loomake/<change-id> の上で始めて向き先が分からなければ、証拠を記録せずに止まる', async () => {
    const repo = makeRepo();
    try {
      repo.git('switch', '-q', '-c', 'loomake/c1');
      repo.plan([{ write: { 'impl.txt': '実装\n' } }, noChange]);
      const r = await runOnce(repo);
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('PR の向き先が分かりません');
      expect(existsSync(join(repo.root, '.loomake/evidence', CHANGE))).toBe(false);
      expect(repo.prs()).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });
});

describe('PR の本文', () => {
  it('[REQ-115] 本文に、proposal の Why と What Changes、完了ゲートの結果、要件ごとのテスト、証拠の記録のパスを含める', () =>
    withPassingRun((repo) => {
      const { body } = repo.prs()[0];
      const order = ['## Why', '検査用。', '## What Changes', '- 検査用', '## 完了ゲートの結果', '合格', '## 要件ごとのテスト', '| REQ-012 | tests/x.test.ts |', '## 証拠の記録', '.loomake/evidence/c1/'];
      let at = -1;
      for (const s of order) {
        const i = body.indexOf(s, at + 1);
        expect(i, s).toBeGreaterThan(at);
        at = i;
      }
    }));
});

describe('gh CLI で PR を作る', () => {
  it('[REQ-116] gh pr create に、タイトル・本文・向き先のブランチを渡す', () =>
    withPassingRun((repo) => {
      const [pr] = repo.prs();
      expect(pr.args.slice(0, 2)).toEqual(['pr', 'create']);
      expect(pr.args).toContain('--body-file');
      expect(pr.body).toContain('## Why');
      expect(pr.args).toEqual(['pr', 'create', '--base', 'main', '--head', 'loomake/c1', '--title', 'c1', '--body-file', pr.args[9]]);
      expect(pr.args[9]).toMatch(/(?:^|[/\\])pr-body\.md$/);
      expect(readFileSync(pr.args[9], 'utf8')).toBe(pr.body);
    }));

  it('[REQ-116] gh にログインしていなければ、証拠を記録せず、ブランチも送らずに止まり、終了コード 1 を返す', () =>
    withPassingRun(
      (repo, r) => {
        expect(r.code).toBe(1);
        expect(r.stdout).toContain('gh auth login');
        expect(existsSync(join(repo.root, '.loomake/evidence'))).toBe(false);
        expect(remoteHas(repo, 'loomake/c1')).toBe(false);
        expect(repo.prs()).toEqual([]);
      },
      (repo) => {
        repo.env.FAKE_GH_AUTH = 'fail';
      },
    ));

  it('[REQ-116] gh にログインしていなければ、エンジンを呼ばず、change のブランチも作らずに止まり、終了コード 1 を返す', () =>
    withPassingRun(
      (repo, r) => {
        expect(r.code).toBe(1);
        expect(r.stdout).toContain('gh auth login');
        expect(repo.calls()).toEqual([]);
        expect(repo.git('branch', '--list', 'loomake/c1')).toBe('');
        expect(existsSync(join(repo.root, '.loomake/runs'))).toBe(false);
      },
      (repo) => {
        repo.env.FAKE_GH_AUTH = 'fail';
      },
    ));

  it('[REQ-116] --dry-run では gh を確かめず、予定のタスクを表示して終了コード 0 を返す', async () => {
    const repo = makeRepo();
    try {
      repo.env.FAKE_GH_AUTH = 'fail';
      const authLog = join(repo.base, 'gh-auth.jsonl');
      repo.env.FAKE_GH_AUTH_LOG = authLog;
      const out: string[] = [];
      const code = await runRun({ root: repo.root, changeId: CHANGE, dryRun: true, interactive: false, confirm: async () => false, stdout: (t) => out.push(t), env: repo.env });
      expect(code).toBe(0);
      expect(out.join('\n')).toContain('エンジンに渡す予定のタスク');
      expect(existsSync(authLog)).toBe(false);
      expect(repo.calls()).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  it('[REQ-116] 実行のあいだに gh からログアウトしたら、証拠を記録せず、ブランチも送らずに止まり、終了コード 1 を返す', async () => {
    const repo = makeRepo();
    try {
      const authLog = join(repo.base, 'gh-auth.jsonl');
      repo.env.FAKE_GH_AUTH_LOG = authLog;
      // 1 回目の呼び出しで、エンジンが実装と同時に gh-logout を作る
      repo.plan([{ write: { 'impl.txt': '実装\n', '../gh-logout': '' } }, noChange]);
      const out: string[] = [];
      const code = await runRun({ root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, stdout: (t) => out.push(t), env: repo.env, fileExists: () => false });
      expect(code).toBe(1);
      expect(repo.calls().length).toBeGreaterThan(0);
      expect(readFileSync(authLog, 'utf8').trim().split('\n').map((line) => JSON.parse(line))).toEqual([
        { args: ['auth', 'status'], status: 0 },
        { args: ['auth', 'status'], status: 1 },
      ]);
      expect(out.join('\n')).toContain('最後の検査結果：合格');
      expect(out.join('\n')).toContain('gh auth login');
      expect(existsSync(join(repo.root, '.loomake/evidence'))).toBe(false);
      expect(remoteHas(repo, 'loomake/c1')).toBe(false);
    } finally {
      repo.cleanup();
    }
  });
});
