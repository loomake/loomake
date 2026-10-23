import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runRun } from '@loomake/runner';
import { CHANGE, makeRepo, type FakeStep, type Repo } from './helpers.js';

/** 1 つ目のタスクで steps を行わせ、run の結果と、そのあとのコミットの数を返す */
async function runWith(step: FakeStep, setup?: (repo: Repo) => void) {
  const repo = makeRepo();
  try {
    setup?.(repo);
    if (setup) {
      repo.git('add', '-A');
      repo.git('commit', '-q', '-m', '準備');
    }
    repo.plan([{ ...step, write: { 'impl.txt': '実装\n', ...step.write } }, {}]);
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
    const commits = Number(repo.git('rev-list', '--count', 'HEAD'));
    return { code, stdout: out.join('\n'), commits, status: repo.git('status', '--porcelain', '--untracked-files=all'), repo };
  } catch (e) {
    repo.cleanup();
    throw e;
  }
}

async function check(step: FakeStep, setup: ((repo: Repo) => void) | undefined, fn: (r: Awaited<ReturnType<typeof runWith>>) => void | Promise<void>) {
  const r = await runWith(step, setup);
  try {
    await fn(r);
  } finally {
    r.repo.cleanup();
  }
}

const withTest = (repo: Repo) => repo.write('tests/a.test.ts', "it('[REQ-012] 確かめる', () => {});\n");
const stopped = (r: Awaited<ReturnType<typeof runWith>>, base: number) => {
  expect(r.code).toBe(1);
  expect(r.stdout).toContain('不正な直し方を見つけました');
  expect(r.commits).toBe(base);
};

describe('テストの削除と skip・todo の検出', () => {
  it('[REQ-109] テストファイルを消したら、削除を表示し、コミットせずに止まる', () =>
    check({ delete: ['tests/a.test.ts'] }, withTest, (r) => {
      stopped(r, 2);
      expect(r.stdout).toContain('tests/a.test.ts：テストファイルを消しました');
      expect(r.status).toContain('tests/a.test.ts');
    }));

  it('[REQ-109] テストファイルに it.skip の行を足したら、その行を表示して止まる', () =>
    check({ write: { 'tests/a.test.ts': "it.skip('[REQ-012] 確かめる', () => {});\n" } }, withTest, (r) => {
      stopped(r, 2);
      expect(r.stdout).toContain("skip・todo を足しました：it.skip('[REQ-012] 確かめる'");
    }));

  it('[REQ-109] ふつうのテストを足しただけなら、止まらずにコミットする', () =>
    check({ write: { 'tests/b.test.ts': "it('[REQ-012] もう一つ', () => {});\n" } }, withTest, (r) => {
      expect(r.code).toBe(0);
      expect(r.stdout).not.toContain('不正な直し方');
    }));

  it('xit( と describe.todo も skip・todo として見つける（仮定 A-17）', () =>
    check({ write: { 'tests/a.test.ts': "xit('a', () => {});\ndescribe.todo('b');\n" } }, withTest, (r) => {
      stopped(r, 2);
      expect(r.stdout).toContain('xit(');
      expect(r.stdout).toContain('describe.todo');
    }));
});

describe('設定の変更の検出', () => {
  it('[REQ-110] loomake.config.json を変えたら、差分を表示して止まる', () =>
    check({ write: { 'loomake.config.json': '{"openspecValidate":false,"commands":{}}' } }, undefined, (r) => {
      stopped(r, 1);
      expect(r.stdout).toContain('loomake.config.json：設定ファイルを変えました');
      expect(r.stdout).toContain('diff --git a/loomake.config.json');
    }));

  it('[REQ-110] package.json の scripts を変えたら止まる', () =>
    check(
      { write: { 'package.json': JSON.stringify({ scripts: { test: 'echo skip' } }) } },
      (repo) => repo.write('package.json', JSON.stringify({ scripts: { test: 'vitest run' } })),
      (r) => {
        stopped(r, 2);
        expect(r.stdout).toContain('package.json の scripts を変えました');
      },
    ));

  it('[REQ-110] package.json の dependencies だけを変えたら、止まらずにコミットする', () =>
    check(
      { write: { 'package.json': JSON.stringify({ scripts: { test: 'vitest run' }, dependencies: { a: '1.0.0' } }) } },
      (repo) => repo.write('package.json', JSON.stringify({ scripts: { test: 'vitest run' } })),
      (r) => expect(r.code).toBe(0),
    ));

  it('tsconfig と vitest.config も設定ファイルとして見つける（仮定 A-18）', () =>
    check({ write: { 'tsconfig.json': '{}', 'vitest.config.ts': 'export default {};\n' } }, undefined, (r) => {
      stopped(r, 1);
      expect(r.stdout).toContain('tsconfig.json：設定ファイルを変えました');
      expect(r.stdout).toContain('vitest.config.ts：設定ファイルを変えました');
    }));
});

describe('仕様と trace.md の変更の検出', () => {
  it('[REQ-111] openspec/specs/ の下を書き換えたら止まる', () =>
    check({ write: { 'openspec/specs/x/spec.md': '# 書き換えた\n' } }, undefined, (r) => {
      stopped(r, 1);
      expect(r.stdout).toContain('openspec/specs/x/spec.md：いまの仕様を変えました');
    }));

  it('[REQ-111] change の trace.md を書き換えたら止まる', () =>
    check({ write: { [`openspec/changes/${CHANGE}/trace.md`]: '# 書き換えた\n' } }, undefined, (r) => {
      stopped(r, 1);
      expect(r.stdout).toContain(`openspec/changes/${CHANGE}/trace.md：trace.md を変えました`);
    }));
});

describe('止まったときの差分の表示と承認', () => {
  it('[REQ-112] 理由と差分を表示し、変更を作業ツリーに残し、承認のしかたを案内して終了コード 1 を返す', () =>
    check({ write: { 'loomake.config.json': '{"commands":{}}' } }, undefined, (r) => {
      stopped(r, 1);
      expect(r.stdout).toContain('-{"openspecValidate":false');
      expect(r.stdout).toContain('自分でコミットしてから、もう一度 loomake run を実行してください');
      expect(r.status).toContain('loomake.config.json');
      expect(r.status).toContain('impl.txt');
      // index には何も載っていない
      expect(r.repo.git('diff', '--cached', '--name-only')).toBe('');
      expect(readFileSync(join(r.repo.root, 'loomake.config.json'), 'utf8')).toBe('{"commands":{}}');
    }));

  it('[REQ-112] 承認せずにもう一度実行すると、未コミットの変更があるので始めない', () =>
    check({ write: { 'loomake.config.json': '{"commands":{}}' } }, undefined, async (r) => {
      const out: string[] = [];
      const code = await runRun({
        root: r.repo.root,
        changeId: CHANGE,
        interactive: false,
        confirm: async () => false,
        stdout: (t) => out.push(t),
        env: r.repo.env,
        fileExists: () => false,
      });
      expect(code).toBe(1);
      expect(out.join('\n')).toContain('未コミットの変更');
      expect(existsSync(join(r.repo.root, 'impl.txt'))).toBe(true);
    }));
});
