import { describe, it, expect, vi } from 'vitest';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findViolations, runRun } from '@loomake/runner';
import { CHANGE, makeRepo, type FakeStep, type Repo } from './helpers.js';

// git・node・verify のコマンドを何度も起動するので、Windows では 1 件に 10 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

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
      expect(r.repo.git('show', 'HEAD:tests/b.test.ts')).toBe("it('[REQ-012] もう一つ', () => {});");
      expect(r.repo.git('log', '--format=%s', '--', 'tests/b.test.ts')).toBe('run(c1): 1.1 一つ目のタスク（REQ-012）');
    }));

  it.each(['it.skipIf(true)', 'describe.skipIf(true)', 'it.runIf(false)', 'it.concurrent.skip'])('[REQ-109] テストファイルに %s の行を足したら止まる', (call) =>
    check({ write: { 'tests/a.test.ts': `${call}('[REQ-012] 確かめる', () => {});\n` } }, withTest, (r) => {
      stopped(r, 2);
      expect(r.stdout).toContain(`skip・todo を足しました：${call}(`);
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

  it('[REQ-110] 子パッケージの package.json の scripts を変えたら止まる', () =>
    check(
      { write: { 'packages/app/package.json': JSON.stringify({ scripts: { test: 'echo skip' } }) } },
      (repo) => repo.write('packages/app/package.json', JSON.stringify({ scripts: { test: 'vitest run' } })),
      (r) => {
        stopped(r, 2);
        expect(r.stdout).toContain('packages/app/package.json：package.json の scripts を変えました');
      },
    ));

  it('[REQ-110] scripts のある package.json を消したら止まる', () =>
    check(
      { delete: ['packages/app/package.json'] },
      (repo) => repo.write('packages/app/package.json', JSON.stringify({ scripts: { test: 'vitest run' } })),
      (r) => {
        stopped(r, 2);
        expect(r.stdout).toContain('packages/app/package.json：package.json の scripts を変えました');
      },
    ));

  it('[REQ-110] package.json の dependencies だけを変えたら、止まらずにコミットする', () =>
    check(
      { write: { 'package.json': JSON.stringify({ scripts: { test: 'vitest run' }, dependencies: { a: '1.0.0' } }) } },
      (repo) => repo.write('package.json', JSON.stringify({ scripts: { test: 'vitest run' } })),
      (r) => {
        expect(r.code).toBe(0);
        expect(JSON.parse(r.repo.git('show', 'HEAD:package.json'))).toEqual({ scripts: { test: 'vitest run' }, dependencies: { a: '1.0.0' } });
        expect(r.repo.git('log', '-1', '--format=%s', '--', 'package.json')).toBe('run(c1): 1.1 一つ目のタスク（REQ-012）');
      },
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

  it('[REQ-111] tasks.md から未完了のタスクの行を消したら止まる', () =>
    check({ write: { [`openspec/changes/${CHANGE}/tasks.md`]: '## 1. 実装\n- [ ] 1.1 一つ目のタスク（REQ-012）\n' } }, undefined, (r) => {
      stopped(r, 1);
      expect(r.stdout).toContain(`openspec/changes/${CHANGE}/tasks.md：change の文書を変えました`);
    }));

  it('[REQ-111] 差分仕様から Requirement を消したら止まる', () =>
    check({ write: { [`openspec/changes/${CHANGE}/specs/x/spec.md`]: '## ADDED Requirements\n' } }, undefined, (r) => {
      stopped(r, 1);
      expect(r.stdout).toContain(`openspec/changes/${CHANGE}/specs/x/spec.md：change の文書を変えました`);
    }));

  it('[REQ-111] openspecDir を変えたプロジェクトでは、その下の仕様と change の文書の変更を見つける', () => {
    const repo = makeRepo();
    try {
      repo.write('spec/specs/x/spec.md', '# 仕様\n');
      repo.write('spec/changes/c1/trace.md', '# trace\n');
      repo.git('add', '-A');
      repo.git('commit', '-q', '-m', '準備');
      repo.write('spec/specs/x/spec.md', '# 書き換えた\n');
      repo.write('spec/changes/c1/trace.md', '# 書き換えた\n');
      const { findings } = findViolations(repo.root, repo.env, 'spec');
      expect(findings).toEqual([
        { file: 'spec/changes/c1/trace.md', reason: 'trace.md を変えました' },
        { file: 'spec/specs/x/spec.md', reason: 'いまの仕様を変えました' },
      ]);
    } finally {
      repo.cleanup();
    }
  });
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

describe('エンジンによるコミットとブランチの切り替えの検出', () => {
  const commit = [['add', '-A'], ['commit', '-q', '-m', 'エンジンのコミット']];
  const moved = (r: Awaited<ReturnType<typeof runWith>>) => {
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('エンジンが HEAD かブランチを変えました');
    expect(r.stdout).toContain('git reset --hard ');
    expect(readFileSync(join(r.repo.root, `openspec/changes/${CHANGE}/tasks.md`), 'utf8')).toContain('- [ ] 1.1');
  };

  it('[REQ-126] エンジンが自分でコミットしたら、前後の SHA を表示し、タスクを完了にせずに止まる', () =>
    check({ git: commit }, undefined, (r) => {
      moved(r);
      const [after, before] = r.repo.git('log', '--format=%H', '-2').split('\n');
      expect(r.stdout).toContain(`呼ぶ前：loomake/${CHANGE} ${before}`);
      expect(r.stdout).toContain(`呼んだ後：loomake/${CHANGE} ${after}`);
      // run はコミットを作らず、エンジンのコミットも取り消さない
      expect(r.commits).toBe(2);
      expect(r.repo.git('log', '-1', '--format=%s')).toBe('エンジンのコミット');
    }));

  it('[REQ-126] 設定を変えてコミットしたら、その差分を表示して止まる', () =>
    check({ write: { 'loomake.config.json': '{"commands":{}}' }, git: commit }, undefined, (r) => {
      moved(r);
      expect(r.stdout).toContain('+{"commands":{}}');
      expect(r.stdout).toContain('-{"openspecValidate":false');
    }));

  it('[REQ-126] エンジンが別のブランチに切り替えたら、前後のブランチ名を表示し、ブランチを戻さずに止まる', () =>
    check({ git: [['switch', '-q', '-c', 'other']] }, undefined, (r) => {
      moved(r);
      expect(r.stdout).toMatch(new RegExp(`呼ぶ前：loomake/${CHANGE} `));
      expect(r.stdout).toMatch(/呼んだ後：other /);
      expect(r.repo.git('rev-parse', '--abbrev-ref', 'HEAD')).toBe('other');
      expect(r.status).toContain('impl.txt');
    }));

  it('[REQ-126] コミットしてから失敗したら、HEAD が変わったことを理由に含めて止まる', () =>
    check({ git: commit, exitCode: 1 }, undefined, (r) => {
      moved(r);
      expect(r.stdout).toMatch(/loomake run を止めました：エンジンが HEAD かブランチを変えました（.*）。エンジンが終了コード 1 で終わりました/);
    }));

  it('[REQ-126] 完了ゲートの直しでエンジンがコミットしたら、完了ゲートのタスクを完了にせずに止まる', async () => {
    const repo = makeRepo();
    try {
      repo.plan([{}, {}, { write: { 'impl.txt': '直した\n' }, git: commit }]);
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
      expect(code).toBe(1);
      expect(out.join('\n')).toContain('エンジンが HEAD かブランチを変えました');
      expect(repo.calls()).toHaveLength(3);
      expect(readFileSync(join(repo.root, `openspec/changes/${CHANGE}/tasks.md`), 'utf8')).toContain('- [ ] 3.1');
      expect(repo.git('log', '-1', '--format=%s')).toBe('エンジンのコミット');
    } finally {
      repo.cleanup();
    }
  });

  it('[REQ-126] エンジンがコミットせずに終えたら、止まらずにタスクを完了にしてコミットする', () =>
    check({}, undefined, (r) => {
      expect(r.stdout).not.toContain('エンジンが HEAD かブランチを変えました');
      expect(r.repo.git('log', '--format=%s', '--reverse').split('\n')).toContain(`run(${CHANGE}): 1.1 一つ目のタスク（REQ-012）`);
    }));
});

describe('git の設定とフックの変更の検出', () => {
  const stopped = (r: Awaited<ReturnType<typeof runWith>>) => {
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('エンジンが git の設定かフックを変えました');
    expect(r.commits).toBe(1);
    expect(readFileSync(join(r.repo.root, `openspec/changes/${CHANGE}/tasks.md`), 'utf8')).toContain('- [ ] 1.1');
  };

  it('[REQ-198] エンジンがフックを足したら、コミットせず、フックを実行せずに止まる', () =>
    check({ write: { '.git/hooks/pre-commit': `#!/bin/sh\necho ran > hook-ran.txt\n` }, chmod: ['.git/hooks/pre-commit'] }, undefined, (r) => {
      stopped(r);
      expect(existsSync(join(r.repo.root, 'hook-ran.txt'))).toBe(false);
      // run は書き換えを戻さない
      expect(existsSync(join(r.repo.root, '.git/hooks/pre-commit'))).toBe(true);
    }));

  it('[REQ-198] エンジンが git の設定を変えたら、コミットせずに止まる', () =>
    check({ git: [['config', 'core.hooksPath', 'my-hooks']] }, undefined, (r) => {
      stopped(r);
      expect(r.repo.git('config', '--get', 'core.hooksPath')).toBe('my-hooks');
    }));

  it('[REQ-198] run の前からあるフックは、run のコミットで動く', () =>
    check({}, (repo) => {
      const hook = join(repo.root, '.git/hooks/post-commit');
      writeFileSync(hook, `#!/bin/sh\necho ran >> "${join(repo.base, 'post-commit.log')}"\n`);
      chmodSync(hook, 0o755);
      repo.write('setup.txt', '準備\n');
    }, (r) => {
      expect(r.stdout).not.toContain('エンジンが git の設定かフックを変えました');
      expect(readFileSync(join(r.repo.root, `openspec/changes/${CHANGE}/tasks.md`), 'utf8')).toContain('- [x] 1.1');
      expect(existsSync(join(r.repo.base, 'post-commit.log'))).toBe(true);
      expect(readFileSync(join(r.repo.base, 'post-commit.log'), 'utf8').trim().split('\n').length).toBeGreaterThan(1);
    }));
});

describe('テストの検査を弱める変更の検出', () => {
  const withAdd = (repo: Repo) => repo.write('tests/add.test.ts', "it('[REQ-012] 足す', () => {\n  expect(add(1, 2)).toBe(3);\n  expect(add(2, 2)).toBe(4);\n});\n");

  it('[REQ-201] 既存のテストから検査の行を消したら、コミットせずに止まる', () =>
    check({ write: { 'tests/add.test.ts': "it('[REQ-012] 足す', () => {\n  expect(add(1, 2)).toBe(3);\n});\n" } }, withAdd, (r) => {
      stopped(r, 2);
      expect(r.stdout).toContain('tests/add.test.ts：テストの検査を減らしました');
    }));

  it('[REQ-201] 必ず通る検査に書き換えたら、コミットせずに止まる', () =>
    check({ write: { 'tests/add.test.ts': "it('[REQ-012] 足す', () => {\n  expect(true).toBe(true);\n  expect(add(2, 2)).toBe(4);\n});\n" } }, withAdd, (r) => {
      stopped(r, 2);
      expect(r.stdout).toContain('tests/add.test.ts：必ず通る検査を足しました：expect(true).toBe(true);');
    }));

  it('[REQ-201] テストを足すだけなら止まらない', () =>
    check({ write: { 'tests/add.test.ts': "it('[REQ-012] 足す', () => {\n  expect(add(1, 2)).toBe(3);\n  expect(add(2, 2)).toBe(4);\n  expect(add(0, 0)).toBe(0);\n});\n" } }, withAdd, (r) => {
      expect(r.stdout).not.toContain('不正な直し方を見つけました');
      expect(readFileSync(join(r.repo.root, `openspec/changes/${CHANGE}/tasks.md`), 'utf8')).toContain('- [x] 1.1');
    }));
});
