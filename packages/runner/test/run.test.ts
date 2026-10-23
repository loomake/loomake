import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runRun, type RunOptions, type RunSummary } from '@loomake/runner';
import { main } from '../../cli/src/main.js';
import { traceMd } from '../../kit/test/project.js';
import { CHANGE, makeRepo, type Repo } from './helpers.js';

async function run(repo: Repo, opts: Partial<RunOptions> = {}) {
  const out: string[] = [];
  const code = await runRun({
    root: repo.root,
    changeId: CHANGE,
    interactive: false,
    confirm: async () => false,
    stdout: (t) => out.push(t),
    env: repo.env,
    fileExists: () => false,
    ...opts,
  });
  return { code, stdout: out.join('\n') };
}

async function cli(repo: Repo, ...args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  // main は process.env を使うので、テストのあいだだけ差し替える
  const saved = { ...process.env };
  Object.assign(process.env, repo.env);
  try {
    const code = await main(['run', '--change', CHANGE, ...args], { cwd: repo.root, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
    return { code, stdout: out.join('\n'), stderr: err.join('\n') };
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}

const tasksMd = (repo: Repo) => readFileSync(join(repo.root, 'openspec/changes', CHANGE, 'tasks.md'), 'utf8');
const runDir = (repo: Repo) => {
  const base = join(repo.root, '.loomake/runs');
  const [dir] = readdirSync(base).filter((d) => d !== '.gitignore');
  return join(base, dir);
};
const summary = (repo: Repo): RunSummary => JSON.parse(readFileSync(join(runDir(repo), 'summary.json'), 'utf8'));
const log = (repo: Repo) => repo.git('log', '--format=%s', 'loomake/c1').split('\n');

// 1.1 で impl.txt を書くと、完了ゲートに合格する
const passing = [{ write: { 'impl.txt': '実装\n' } }, {}];

async function withRepo(fn: (repo: Repo) => Promise<void>, init?: Parameters<typeof makeRepo>[0]) {
  const repo = makeRepo(init);
  try {
    await fn(repo);
  } finally {
    repo.cleanup();
  }
}

describe('実行前の確認', () => {
  it('[REQ-093] 仕様ゲートに不合格なら、内容を表示し、ブランチを作らず、エンジンを呼ばずに終了コード 1 を返す', () =>
    withRepo(
      async (repo) => {
        const r = await run(repo);
        expect(r.code).toBe(1);
        expect(r.stdout).toContain('仕様ゲートに不合格');
        expect(r.stdout).toContain('Q-01');
        expect(repo.git('branch', '--list', 'loomake/c1')).toBe('');
        expect(repo.calls()).toEqual([]);
      },
      { trace: traceMd({ questions: ['| Q-01 | REQ-012 | 何回ですか | 3 / 5 | 5 | yes | |'] }) },
    ));

  it('[REQ-093] 仕様ゲートに合格すれば、実装に進む', () =>
    withRepo(async (repo) => {
      repo.plan(passing);
      expect((await run(repo)).code).toBe(0);
      expect(repo.calls().length).toBeGreaterThan(0);
    }));

  it('[REQ-094] コミット済みのファイルを書き換えていたら、ファイル名を出し、エンジンを呼ばずに終了コード 1 を返す', () =>
    withRepo(async (repo) => {
      repo.write('AGENTS.md', '# 書き換えた\n');
      const r = await run(repo);
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('AGENTS.md');
      expect(repo.calls()).toEqual([]);
    }));

  it('[REQ-094] git が追跡していない新しいファイルがあれば、エンジンを呼ばずに終了コード 1 を返す', () =>
    withRepo(async (repo) => {
      repo.write('new.txt', '新しい\n');
      expect((await run(repo)).code).toBe(1);
      expect(repo.calls()).toEqual([]);
    }));

  it('[REQ-095] --dry-run は、タスクの一覧と最初の指示を表示し、ブランチを作らず、エンジンを呼ばずに終了コード 0 を返す', () =>
    withRepo(async (repo) => {
      const r = await run(repo, { dryRun: true });
      expect(r.code).toBe(0);
      expect(r.stdout).toContain('- [ ] 1.1 一つ目のタスク（REQ-012）');
      expect(r.stdout).toContain('- [ ] 1.2 二つ目のタスク');
      expect(r.stdout).toContain('# loomake run の指示');
      expect(repo.git('branch', '--list', 'loomake/c1')).toBe('');
      expect(repo.calls()).toEqual([]);
    }));
});

describe('ブランチとタスク', () => {
  it('[REQ-096] loomake/<change-id> がなければ、いまの HEAD から作ってコミットする', () =>
    withRepo(async (repo) => {
      const head = repo.git('rev-parse', 'HEAD');
      repo.plan(passing);
      await run(repo);
      expect(repo.git('merge-base', 'main', 'loomake/c1')).toBe(head);
      expect(log(repo)).toContain('run(c1): 1.1 一つ目のタスク（REQ-012）');
    }));

  it('[REQ-096] loomake/<change-id> があれば、切り替えてその続きにコミットする', () =>
    withRepo(async (repo) => {
      repo.git('switch', '-q', '-c', 'loomake/c1');
      repo.write('earlier.txt', '前の実行\n');
      repo.git('add', '-A');
      repo.git('commit', '-q', '-m', '前の実行のコミット');
      repo.git('switch', '-q', 'main');
      repo.plan(passing);
      await run(repo);
      expect(log(repo)).toContain('前の実行のコミット');
    }));

  it('[REQ-097] 未完了のタスクを上から順に、1 回に 1 つずつ渡す', () =>
    withRepo(async (repo) => {
      repo.plan(passing);
      await run(repo);
      const [first, second] = repo.calls().map((c) => c.prompt.split('## 対象\n\n')[1].split('\n')[0]);
      expect(first).toBe('- [ ] 1.1 一つ目のタスク（REQ-012）');
      expect(second).toBe('- [ ] 1.2 二つ目のタスク');
    }));

  it('[REQ-097] 完了済みのタスクは渡さない', () =>
    withRepo(
      async (repo) => {
        repo.plan([{ write: { 'impl.txt': '実装\n' } }]);
        await run(repo);
        expect(repo.calls()).toHaveLength(1);
        expect(repo.calls()[0].prompt).toContain('- [ ] 1.2 二つ目のタスク');
      },
      { tasks: '- [x] 1.1 一つ目\n- [ ] 1.2 二つ目のタスク\n- [ ] 3.1 `pnpm -s verify --change c1 --done` を通す\n' },
    ));

  it('[REQ-098] 指示に、AGENTS.md・タスク・差分仕様・trace.md・2 つの決まりを含める', () =>
    withRepo(async (repo) => {
      const r = await run(repo, { dryRun: true });
      expect(r.stdout).toContain('テスト用の共通ルール。');
      expect(r.stdout).toContain('### specs/x/spec.md');
      expect(r.stdout).toContain('### Requirement: 検査用の振る舞い');
      expect(r.stdout).toContain('# Trace: c1');
      expect(r.stdout).toContain('tasks.md・trace.md・openspec/specs/ を書き換えない');
      expect(r.stdout).toContain('`LOOMAKE-QUESTION:` で始まる行に質問を書き');
    }));

  it('[REQ-099] タスクを終えるたびに、変更と完了にした tasks.md を run(<change-id>): <タスク> でコミットする', () =>
    withRepo(async (repo) => {
      repo.plan(passing);
      await run(repo);
      const rev = repo.git('log', '--format=%H', '--grep', '^run(c1): 1.1', 'loomake/c1');
      const commit = repo.git('log', '--format=%s', '--name-only', '-1', rev);
      expect(commit.split('\n')[0]).toBe('run(c1): 1.1 一つ目のタスク（REQ-012）');
      expect(commit).toContain('impl.txt');
      expect(commit).toContain('openspec/changes/c1/tasks.md');
      expect(repo.git('show', `${rev}:openspec/changes/c1/tasks.md`)).toContain('- [x] 1.1 一つ目のタスク');
    }));
});

describe('完了ゲートと直し', () => {
  it('[REQ-100] 不合格なら内容をエンジンに渡して直させ、直しをコミットし、合格したら完了ゲートのタスクを完了にする', () =>
    withRepo(async (repo) => {
      repo.plan([{}, {}, { write: { 'impl.txt': '直した\n' } }]);
      const r = await run(repo);
      expect(r.code).toBe(0);
      const fix = repo.calls()[2].prompt;
      expect(fix).toContain('## 完了ゲートの不合格の内容');
      expect(fix).toContain('テストが無い要件：REQ-012');
      const messages = log(repo);
      expect(messages.indexOf('run(c1): 完了ゲートに合格')).toBe(messages.indexOf('run(c1): 完了ゲートの直し（1 回目）') - 1);
      expect(tasksMd(repo)).toContain('- [x] 3.1');
    }));

  it('[REQ-100] 完了ゲートのタスクはエンジンに渡さない', () =>
    withRepo(async (repo) => {
      repo.plan(passing);
      await run(repo);
      expect(repo.calls()).toHaveLength(2);
      for (const c of repo.calls()) expect(c.prompt).not.toContain('3.1');
    }));

  it('[REQ-104] 直しの回数が上限に達したら止まり、終了コード 1 を返す', () =>
    withRepo(
      async (repo) => {
        const r = await run(repo);
        expect(r.code).toBe(1);
        expect(r.stdout).toContain('直しの回数の上限（2 回）に達しました');
        expect(repo.calls()).toHaveLength(4);
        expect(tasksMd(repo)).toContain('- [ ] 3.1');
      },
      { run: { maxFixes: 2 } },
    ));

  it('[REQ-105] 実行時間が上限に達したら、エンジンを止めて止まる', () =>
    withRepo(
      async (repo) => {
        repo.plan([{ sleepMs: 10_000 }]);
        const start = Date.now();
        const r = await run(repo);
        expect(r.code).toBe(1);
        expect(r.stdout).toContain('実行時間の上限に達しました');
        expect(Date.now() - start).toBeLessThan(8_000);
      },
      { run: { timeoutMinutes: 0.02 } },
    ));
});

describe('エンジンの選び方と権限', () => {
  it('[REQ-101] ふだんは -p と JSON の出力で呼び、許可する操作にファイルの読み書きと commands を渡し、権限確認は飛ばさない', () =>
    withRepo(async (repo) => {
      repo.plan(passing);
      await run(repo);
      const { args } = repo.calls()[0];
      expect(args.slice(0, 3)).toEqual(['-p', '--output-format', 'json']);
      expect(args).toEqual(expect.arrayContaining(['--allowedTools', 'Read', 'Edit', 'Write', 'Bash(node write-report.mjs:*)']));
      expect(args).not.toContain('--dangerously-skip-permissions');
    }));

  it('[REQ-101] 知らないエンジンでは、使い方の誤りとして終了コード 2 を返す', () =>
    withRepo(async (repo) => {
      const r = await cli(repo, '--engine', 'codex');
      expect(r.code).toBe(2);
      expect(r.stderr).toContain('初版で使えるのは claude-code だけです');
    }));

  it('[REQ-101] claude コマンドがなければ、Claude Code を入れるよう表示して終了コード 2 を返す', () =>
    withRepo(async (repo) => {
      repo.env.PATH = dirname(process.execPath);
      const r = await cli(repo);
      expect(r.code).toBe(2);
      expect(r.stderr).toContain('claude コマンドが見つかりません');
    }));

  it('[REQ-121] LOOMAKE_SANDBOX=1 で --skip-permissions を付ければ、権限確認を飛ばして呼ぶ', () =>
    withRepo(async (repo) => {
      repo.env.LOOMAKE_SANDBOX = '1';
      repo.plan(passing);
      await run(repo, { skipPermissions: true });
      expect(repo.calls()[0].args).toContain('--dangerously-skip-permissions');
    }));

  it('[REQ-121] LOOMAKE_SANDBOX=1 でなければ、--skip-permissions を断り、許可ドメインを表示して終了コード 2 を返す', () =>
    withRepo(async (repo) => {
      const r = await cli(repo, '--skip-permissions');
      expect(r.code).toBe(2);
      expect(r.stderr).toContain('LOOMAKE_SANDBOX=1');
      expect(r.stderr).toContain('registry.npmjs.org');
      expect(repo.calls()).toEqual([]);
    }));
});

describe('止まる条件と報告', () => {
  it('[REQ-106] エンジンが LOOMAKE-QUESTION: を出したら、質問を表示し、タスクを完了にせずに止まる', () =>
    withRepo(async (repo) => {
      repo.plan([{ write: { 'impl.txt': '途中\n' }, output: '考えました。\nLOOMAKE-QUESTION: 上限は何件ですか' }]);
      const r = await run(repo);
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('上限は何件ですか');
      expect(tasksMd(repo)).toContain('- [ ] 1.1');
      expect(log(repo)).toEqual(['init']);
    }));

  it('[REQ-107] 止まったら、理由・終えたタスク・残ったタスク・最後の検査結果を表示し、summary.json にも書く', () =>
    withRepo(async (repo) => {
      repo.plan([{ write: { 'impl.txt': '実装\n' } }, { output: 'LOOMAKE-QUESTION: 二つ目で迷いました' }]);
      const r = await run(repo);
      expect(r.stdout).toContain('loomake run を止めました：エンジンが質問しました：二つ目で迷いました');
      expect(r.stdout).toContain('終えたタスク：\n  - 1.1 一つ目のタスク（REQ-012）');
      expect(r.stdout).toContain('最後の検査結果：なし');
      expect(summary(repo)).toMatchObject({
        status: 'stopped',
        doneTasks: ['1.1 一つ目のタスク（REQ-012）'],
        remainingTasks: ['1.2 二つ目のタスク', '3.1 `pnpm -s verify --change c1 --done` を通す'],
        lastVerify: null,
      });
    }));
});

describe('実行の記録', () => {
  it('[REQ-117] 指示・出力・検査結果と summary.json を、何回目かが分かる名前で保存する', () =>
    withRepo(async (repo) => {
      repo.plan(passing);
      await run(repo);
      const files = readdirSync(runDir(repo));
      expect(files).toEqual(expect.arrayContaining(['01-prompt.md', '01-output.json', '02-prompt.md', '02-output.json', '02-verify.json', 'summary.json']));
      expect(runDir(repo)).toMatch(/[/\\]\.loomake[/\\]runs[/\\]\d{8}T\d{6}Z-c1$/);
    }));

  it('[REQ-117] 実行の記録は、git の未コミットの変更に出てこない', () =>
    withRepo(async (repo) => {
      repo.plan(passing);
      await run(repo);
      expect(existsSync(join(repo.root, '.loomake/runs/.gitignore'))).toBe(true);
      expect(repo.git('status', '--porcelain', '--untracked-files=all')).toBe('');
    }));

  it('[REQ-118] 出力の中のトークンを *** に置き換えて保存し、環境変数は保存しない', () =>
    withRepo(async (repo) => {
      repo.env.SECRET_FOR_TEST = 'env-secret-value';
      repo.plan([{ write: { 'impl.txt': '実装\n' }, output: 'トークン ghp_abcdefghijklmnopqrstuvwxyz0123 を見ました' }, {}]);
      await run(repo);
      const saved = readdirSync(runDir(repo)).map((f) => readFileSync(join(runDir(repo), f), 'utf8')).join('\n');
      expect(saved).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz0123');
      expect(saved).toContain('トークン *** を見ました');
      expect(saved).not.toContain('env-secret-value');
    }));
});

describe('コンテナ', () => {
  const outside = (repo: Repo) => {
    for (const k of ['REMOTE_CONTAINERS', 'CODESPACES', 'DEVCONTAINER']) repo.env[k] = undefined;
  };

  it('[REQ-120] REMOTE_CONTAINERS が設定されていれば、コンテナの中とみなして警告しない', () =>
    withRepo(async (repo) => {
      outside(repo);
      repo.env.REMOTE_CONTAINERS = 'true';
      repo.plan(passing);
      const r = await run(repo);
      expect(r.stdout).not.toContain('コンテナの外');
      expect(r.code).toBe(0);
    }));

  it('[REQ-122] コンテナの外で確認に断ると、エンジンを呼ばずに終了コード 1 を返す', () =>
    withRepo(async (repo) => {
      outside(repo);
      const questions: string[] = [];
      const r = await run(repo, { interactive: true, confirm: async (q) => (questions.push(q), false) });
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('コンテナの外');
      expect(questions).toEqual(['続けますか [y/N] ']);
      expect(repo.calls()).toEqual([]);
    }));

  it('[REQ-122] コンテナの外で確認を受け付けられなければ、警告して終了コード 1 を返す', () =>
    withRepo(async (repo) => {
      outside(repo);
      const r = await run(repo);
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('コンテナの外');
      expect(repo.calls()).toEqual([]);
    }));
});

describe('中断', () => {
  it('[REQ-124] 2 つ目のタスクの途中で中断されたら、1 つ目のコミットを残し、summary.json に中断を書く', () =>
    withRepo(async (repo) => {
      repo.plan([{ write: { 'impl.txt': '実装\n' } }, { write: { 'half.txt': '途中\n' }, sleepMs: 10_000 }]);
      const controller = new AbortController();
      const timer = setInterval(() => {
        if (repo.calls().length === 2) controller.abort();
      }, 50);
      try {
        const r = await run(repo, { signal: controller.signal });
        expect(r.code).toBe(1);
      } finally {
        clearInterval(timer);
      }
      expect(log(repo)[0]).toBe('run(c1): 1.1 一つ目のタスク（REQ-012）');
      expect(summary(repo)).toMatchObject({ status: 'interrupted', doneTasks: ['1.1 一つ目のタスク（REQ-012）'] });
      expect(tasksMd(repo)).toContain('- [ ] 1.2');
    }));
});

describe('依存と動作環境', () => {
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8'));

  it('[REQ-123] @loomake/runner の dependencies は core・kit・trace だけ', () => {
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(['@loomake/core', '@loomake/kit', '@loomake/trace']);
  });

  it('[REQ-125] @loomake/runner の engines.node は >=20.19.0', () => {
    expect(pkg.engines?.node).toBe('>=20.19.0');
  });
});
