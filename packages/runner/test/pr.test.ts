import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runRun } from '@loomake/runner';
import { CHANGE, makeRepo, type Repo } from './helpers.js';

async function withPassingRun(fn: (repo: Repo, r: { code: number; stdout: string }) => void, setup?: (repo: Repo) => void) {
  const repo = makeRepo();
  try {
    setup?.(repo);
    repo.plan([{ write: { 'impl.txt': '実装\n' } }, {}]);
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
    }));
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
});
