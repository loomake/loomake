import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ProcessLimitError, withProcessBudget } from '../../kit/src/runtime/process.js';
import { readHead } from '../src/git.js';
import { fakeCli, makeRepo, type Repo } from './helpers.js';

// git を何度も起動するので、Windows では 1 件に数秒かかることがある
vi.setConfig({ testTimeout: 60_000 });

/** まとめる前の headState と gitPath が返していた値。終了コードを見ずに標準出力を使う */
function separateReads(repo: Repo) {
  const out = (...args: string[]) => spawnSync('git', args, { cwd: repo.root, env: repo.env, encoding: 'utf8' }).stdout.trim();
  return {
    sha: out('rev-parse', '--verify', '-q', 'HEAD'),
    branch: out('rev-parse', '--abbrev-ref', 'HEAD'),
    config: resolve(repo.root, out('rev-parse', '--git-path', 'config')),
    hooks: resolve(repo.root, out('rev-parse', '--git-path', 'hooks')),
  };
}

const revParses = (cli: ReturnType<typeof fakeCli>) => cli.events().filter((e) => e.event === 'shim-start' && e.args[0] === 'rev-parse').map((e) => e.args);

async function withRepo(setup: (repo: Repo) => void, fn: (repo: Repo) => void | Promise<void>) {
  const repo = makeRepo();
  try {
    setup(repo);
    await fn(repo);
  } finally {
    repo.cleanup();
  }
}

describe('HEAD と git の場所のまとめた読み取り', () => {
  const cases: [string, string, (repo: Repo) => void, number][] = [
    // 場所つきと場所なしで 1 回ずつ
    ['ブランチにいる', '', () => {}, 2],
    ['detached HEAD', '', (repo) => repo.git('checkout', '-q', '--detach'), 2],
    ['HEAD という名前のファイルがある', '', (repo) => repo.write('HEAD', '紛らわしいファイル\n'), 2],
    // コミットがないと、まとめた呼び出しは失敗するので、項目ごとの呼び出し（HEAD 2 回と、場所つきなら場所 1 回）に戻す。1 + 2 + 1 と 1 + 2
    ['HEAD のコミットがない', '[REQ-349]', (repo) => repo.git('checkout', '-q', '--orphan', 'empty'), 7],
  ];
  for (const [name, fallback, setup, calls] of cases) {
    it(`[REQ-348]${fallback}[REQ-126][REQ-198] ${name}とき、別々に読んだときと同じ値を返す`, () =>
      withRepo(setup, (repo) => {
        const expected = separateReads(repo);
        const cli = fakeCli(repo, 'git', { when: 'false' });
        try {
          expect(readHead(repo.root, repo.env, true)).toEqual(expected);
          expect(readHead(repo.root, repo.env)).toEqual({ sha: expected.sha, branch: expected.branch });
          expect(revParses(cli)).toHaveLength(calls);
          expect(revParses(cli)[0]).toEqual(['rev-parse', '--git-path', 'config', '--git-path', 'hooks', 'HEAD', '--abbrev-ref', 'HEAD']);
        } finally {
          cli.restore();
        }
      }));
  }

  it('[REQ-349][REQ-180] まとめた読み取りが 1 操作の期限に達したら、項目ごとの呼び出しを起動せずに止まる', () =>
    withRepo(() => {}, (repo) => {
      const cli = fakeCli(repo, 'git', { when: "args[0] === 'rev-parse'" });
      try {
        let error: unknown;
        try {
          withProcessBudget({ timeoutMs: 20_000, maxOperationMs: 500 }, () => readHead(repo.root, repo.env, true));
        } catch (e) {
          error = e;
        }
        expect(error).toBeInstanceOf(ProcessLimitError);
        expect((error as ProcessLimitError).kind).toBe('timeout');
        expect(revParses(cli)).toHaveLength(1);
      } finally {
        cli.restore();
      }
    }));
});
