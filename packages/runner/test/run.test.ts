import { describe, it, expect, vi } from 'vitest';
import { chmodSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GATE_MARK, RUN_CONFIG_KEYS, runRun, type RunOptions, type RunSummary } from '@loomake/runner';
import { KNOWN_CONFIG_KEYS } from '@loomake/kit';
import { main } from '../../cli/src/main.js';
import { INTERRUPT_SCRIPT, traceMd } from '../../kit/test/project.js';
import { CHANGE, makeRepo, noChange, type Repo } from './helpers.js';
import { killOwnedProcess, processState } from './process-state.js';

// git・node・verify のコマンドを何度も起動するので、Windows では 1 件に 10 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

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
const passing = [{ write: { 'impl.txt': '実装\n' } }, noChange];

// 回収前のゾンビと終了途中の子は、利用者のコードを実行できないので「止まった」とみなす（process-state.ts）
function assertStoppedProcess(pidFile: string) {
  expect(existsSync(pidFile)).toBe(true);
  const pid = Number(readFileSync(pidFile, 'utf8'));
  expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
  expect(processState(pid)).not.toBe('running');
}

function cleanupTestProcess(pidFile: string) {
  if (!existsSync(pidFile)) return;
  const pid = Number(readFileSync(pidFile, 'utf8'));
  if (!Number.isSafeInteger(pid) || pid <= 0) return;
  killOwnedProcess(pid);
}


async function withRepo(fn: (repo: Repo) => Promise<void>, init?: Parameters<typeof makeRepo>[0]) {
  const repo = makeRepo(init);
  try {
    await fn(repo);
  } finally {
    repo.cleanup();
  }
}

describe('run の設定のキー', () => {
  // kit は runner に依存できないので、知っているキーの一覧がずれていないかをここで確かめる（warn-unknown-config-keys の仮定 A-01）
  it('[REQ-039] run が読む設定のキーは、すべて verify と doctor が知っているキーに入っている', () => {
    expect(KNOWN_CONFIG_KEYS.run).toEqual(expect.arrayContaining([...RUN_CONFIG_KEYS]));
  });
});

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

  it('[REQ-094] テストのレポートを .gitignore で除外していなければ、足すよう表示し、エンジンを呼ばずに終了コード 1 を返す', () =>
    withRepo(async (repo) => {
      repo.write('.gitignore', '');
      repo.git('commit', '-q', '-am', '除外をやめる');
      const r = await run(repo);
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('.loomake/test-report.json');
      expect(r.stdout).toContain('.gitignore に足して');
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
      const previous = repo.git('rev-parse', 'HEAD');
      repo.git('switch', '-q', 'main');
      const mainHead = repo.git('rev-parse', 'HEAD');
      repo.plan(passing);
      const result = await run(repo);
      expect(result.code, result.stdout).toBe(0);
      expect(log(repo)).toContain('前の実行のコミット');
      expect(repo.git('branch', '--show-current')).toBe('loomake/c1');
      const implementation = repo.git('log', '--format=%H', '--grep', '^run(c1): 1.1', 'HEAD');
      expect(implementation).toMatch(/^[a-f0-9]{40}$/);
      expect(repo.git('rev-parse', `${implementation}^`)).toBe(previous);
      expect(repo.git('show', `${implementation}:earlier.txt`)).toBe('前の実行');
      expect(repo.git('show', `${implementation}:impl.txt`)).toBe('実装');
      expect(repo.git('rev-parse', 'main')).toBe(mainHead);
    }));

  it('[REQ-096] 別のブランチから再開したら、loomake/<change-id> の tasks.md で完了済みのタスクを渡さない', () =>
    withRepo(async (repo) => {
      repo.git('switch', '-q', '-c', 'loomake/c1');
      repo.write('impl.txt', '実装\n');
      repo.write('openspec/changes/c1/tasks.md', tasksMd(repo).replace('- [ ] 1.1', '- [x] 1.1'));
      repo.git('add', '-A');
      repo.git('commit', '-q', '-m', 'run(c1): 1.1 一つ目のタスク（REQ-012）');
      repo.git('switch', '-q', 'main');
      repo.plan([noChange]);
      const r = await run(repo);
      expect(r.code, r.stdout).toBe(0);
      expect(repo.calls()).toHaveLength(1);
      expect(repo.calls()[0].prompt.split('## 対象\n\n')[1].split('\n')[0]).toBe('- [ ] 1.2 二つ目のタスク');
    }));

  it('[REQ-096] loomake/<change-id> があるときの --dry-run は、そのブランチのタスクを表示し、元のブランチに戻る', () =>
    withRepo(async (repo) => {
      repo.git('switch', '-q', '-c', 'loomake/c1');
      repo.write('openspec/changes/c1/tasks.md', tasksMd(repo).replace('- [ ] 1.1', '- [x] 1.1'));
      repo.git('commit', '-q', '-am', '1.1 を終えた');
      repo.git('switch', '-q', 'main');
      const r = await run(repo, { dryRun: true });
      expect(r.code).toBe(0);
      expect(r.stdout).not.toContain('- [ ] 1.1');
      expect(r.stdout).toContain('- [ ] 1.2 二つ目のタスク');
      expect(repo.git('rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
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
      const read = (path: string) => readFileSync(join(repo.root, path), 'utf8');
      const documents = {
        'AGENTS.md': read('AGENTS.md') + '\n## appendix\n\nKeep the complete instructions.\n',
        'openspec/changes/c1/specs/x/spec.md': read('openspec/changes/c1/specs/x/spec.md'),
        'openspec/changes/c1/specs/nested/y/spec.md': read('openspec/changes/c1/specs/x/spec.md').replace('検査用の振る舞い', '別の検査用の振る舞い'),
        'openspec/changes/c1/trace.md': read('openspec/changes/c1/trace.md') + '\n## appendix\n\nKeep the requirement sources.\n',
      };
      for (const [path, text] of Object.entries(documents)) repo.write(path, text);
      repo.git('add', '-A');
      repo.git('commit', '-qm', 'complete prompt fixture');
      const r = await run(repo, { dryRun: true });
      expect(r.code, r.stdout).toBe(0);
      for (const text of Object.values(documents)) expect(r.stdout).toContain(text);
      expect(r.stdout).toContain('### specs/nested/y/spec.md');
      expect(r.stdout).toContain('## 対象\n\n- [ ] 1.1 一つ目のタスク（REQ-012）');
      expect(repo.calls()).toEqual([]);
      expect(r.stdout).toContain('テスト用の共通ルール。');
      expect(r.stdout).toContain('### specs/x/spec.md');
      expect(r.stdout).toContain('### Requirement: 検査用の振る舞い');
      expect(r.stdout).toContain('# Trace: c1');
      expect(r.stdout).toContain('tasks.md・trace.md・openspec/specs/ を書き換えない');
      expect(r.stdout).toContain('`LOOMAKE-QUESTION:` で始まる行に質問を書き');
    }));

  it('[REQ-098] 指示に、git でコミットしたりブランチを切り替えたりせず、コミットは loomake run が行うという決まりを含める', () =>
    withRepo(async (repo) => {
      const r = await run(repo, { dryRun: true });
      expect(r.stdout).toContain('- git でコミットしたりブランチを切り替えたりせず、変更は作業ツリーに残して終える。コミットは loomake run が行う。');
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

  it('[REQ-099][REQ-014] * で書いたタスクも、終えたら * [x] にしてコミットする', () =>
    withRepo(
      async (repo) => {
        repo.plan(passing);
        await run(repo);
        expect(repo.git('show', 'loomake/c1:openspec/changes/c1/tasks.md')).toContain('* [x] 1.1 一つ目のタスク');
      },
      { tasks: ['## 1. 実装', '* [ ] 1.1 一つ目のタスク（REQ-012）', '', '## 3. 確認', `* [ ] 3.1 完了ゲートを通す ${GATE_MARK}`, ''].join('\n') },
    ));
});

describe('完了ゲートと直し', () => {
  it('[REQ-100][REQ-111] 不合格なら内容をエンジンに渡して直させ、直しをコミットし、合格したら完了ゲートのタスクを完了にする。run が完了にしたタスクは不正な直し方とみなさない', () =>
    withRepo(async (repo) => {
      repo.plan([noChange, noChange, { write: { 'impl.txt': '直した\n' } }]);
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
        repo.plan([noChange, noChange, { write: { 'fix.txt': '1' } }, { write: { 'fix.txt': '2' } }]);
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
        const pidFile = join(repo.base, 'engine.pid');
        repo.plan([{ sleepMs: 60_000, pidFile }]);
        const start = Date.now();
        try {
          const r = await run(repo);
          expect(r.code).toBe(1);
          expect(r.stdout).toContain('実行時間の上限に達しました');
          expect(Date.now() - start).toBeLessThan(30_000);
          // 確かめたいのは、動いているエンジンを期限で止めること。準備で期限を使い切ってエンジンを起動せずに止まった場合と区別する
          expect(repo.calls(), r.stdout).toHaveLength(1);
          assertStoppedProcess(pidFile);
        } finally { cleanupTestProcess(pidFile); }
      },
      // 負荷の高い CI でも、準備（仕様ゲートと git）のあとにエンジンが起動してから期限に当たる長さにする
      { run: { timeoutMinutes: 0.1 } },
    ));

  it('[REQ-105] 完了ゲートのテストが終わらないまま上限に達したら、テストを止めて止まる', () =>
    withRepo(
      async (repo) => {
        const pidFile = join(repo.base, 'quality.pid');
        repo.write('write-report.mjs', `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(pidFile)}, String(process.pid));\nsetInterval(() => {}, 1000);\n`);
        repo.git('commit', '-q', '-am', '終わらないテスト');
        repo.plan([noChange, noChange]);
        const start = Date.now();
        try {
          const r = await run(repo);
          expect(r.code).toBe(1);
          expect(r.stdout).toContain('実行時間の上限に達しました');
          expect(repo.calls()).toHaveLength(2);
          expect(Date.now() - start).toBeLessThan(30_000);
          expect(tasksMd(repo)).toContain('- [ ] 3.1');
          assertStoppedProcess(pidFile);
        } finally { cleanupTestProcess(pidFile); }
      },
      // 期限は run の開始時に決まるので、準備（仕様ゲート・git・エンジン 2 回・verify）が終わって品質コマンドが起動したあとに期限が来る長さにする。
      // Windows の CI では node と git の起動が遅く、6 秒では品質コマンドが PID を書く前に期限が来た（run 40182208306）。手元の Linux は 1 コアに負荷をかけても 2 秒以内
      { run: { timeoutMinutes: process.platform === 'win32' ? 0.3 : 0.1 } },
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

  it('[REQ-101] change-id が change 名の形でないか archive なら、エンジンを呼ばずに終了コード 2 を返す', () =>
    withRepo(async (repo) => {
      for (const id of ['C1', 'archive']) {
        const r = await cli(repo, '--change', id);
        expect(r.code, id).toBe(2);
        expect(r.stderr, id).toMatch(/英小文字・数字|archive は change-id に使えません/);
      }
      expect(repo.calls()).toEqual([]);
    }));

  it('[REQ-101] change-id にパスの区切りを含めると、使い方の誤りとして終了コード 2 を返す', () =>
    withRepo(async (repo) => {
      const r = await cli(repo, '--change', '../c1');
      expect(r.code).toBe(2);
      expect(r.stderr).toContain('パスの区切り');
      expect(repo.calls()).toEqual([]);
    }));

  it('[REQ-101] claude コマンドがなければ、Claude Code を入れるよう表示して終了コード 2 を返す', () =>
    withRepo(async (repo) => {
      // Nodeの配置先にGitがあるとは限らない。Git自身の実行ファイルの場所だけを使う。
      const gitPath = repo.git('--exec-path');
      expect(existsSync(join(gitPath, process.platform === 'win32' ? 'git.exe' : 'git'))).toBe(true);
      repo.env.PATH = gitPath;
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

  it('[REQ-099] エンジンが 0 以外の終了コードで終わったら、タスクを完了にせず、コミットもせずに止まる', () =>
    withRepo(async (repo) => {
      repo.plan([{ write: { 'impl.txt': '途中\n' }, exitCode: 1 }]);
      const r = await run(repo);
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('エンジンが終了コード 1 で終わりました');
      expect(tasksMd(repo)).toContain('- [ ] 1.1');
      expect(log(repo)).toEqual(['init']);
      expect(summary(repo).status).toBe('stopped');
    }));

  it('[REQ-107] 止まったら、理由・終えたタスク・残ったタスク・最後の検査結果を表示し、summary.json にも書く', () =>
    withRepo(async (repo) => {
      repo.plan([{ write: { 'impl.txt': '実装\n' } }, { output: 'LOOMAKE-QUESTION: 二つ目で迷いました' }]);
      const r = await run(repo);
      expect(r.stdout).toContain('loomake run を止めました：エンジンが質問しました：二つ目で迷いました');
      expect(r.stdout).toContain('終えたタスク：\n  - 1.1 一つ目のタスク（REQ-012）');
      expect(r.stdout).toContain('最後の検査結果：なし');
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('残ったタスク：\n  - 1.2 二つ目のタスク\n  - 3.1 `pnpm -s verify --change c1 --done` を通す');
      expect(summary(repo)).toMatchObject({
        status: 'stopped',
        doneTasks: ['1.1 一つ目のタスク（REQ-012）'],
        remainingTasks: ['1.2 二つ目のタスク', '3.1 `pnpm -s verify --change c1 --done` を通す'],
        lastVerify: null,
      });
    }));
});

describe('実行の記録', () => {
  it('[REQ-117] 1つのタスクと完了ゲートの記録を同じ実行に保存する', () =>
    withRepo(async (repo) => {
      repo.plan([passing[0]]);
      const result = await run(repo);
      expect(result.code, result.stdout).toBe(0);
      expect(repo.calls()).toHaveLength(1);
      const dir = runDir(repo);
      expect(readdirSync(dir)).toEqual(expect.arrayContaining(['01-output.json', '01-prompt.md', '01-verify.json', 'summary.json']));
      expect(readFileSync(join(dir, '01-prompt.md'), 'utf8')).toBe(repo.calls()[0].prompt);
      expect(JSON.parse(readFileSync(join(dir, '01-output.json'), 'utf8')).result).toBe('終えました');
      expect(JSON.parse(readFileSync(join(dir, '01-verify.json'), 'utf8'))).toMatchObject({ schemaVersion: '2.0.0', scope: 'local', summary: { fail: 0, pending: 0 } });
      expect(summary(repo).status).toBe('completed');
    }, { tasks: '- [ ] 1.1 一つ目のタスク（REQ-012）\n- [ ] 3.1 品質確認 <!-- loomake:gate=done -->\n' }));

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
      repo.plan([{ write: { 'impl.txt': '実装\n' }, output: 'トークン ghp_abcdefghijklmnopqrstuvwxyz0123 を見ました' }, noChange]);
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
      repo.plan([{ write: { 'impl.txt': '実装\n' } }, { write: { 'half.txt': '途中\n' }, sleepMs: 60_000 }]);
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

  // Windows では品質コマンドを別のプロセスグループにしないので、Ctrl-C がコマンドに届く。SIGINT をまねる手段もない（stop-gate-on-interrupt の仮定 A-02）
  it.runIf(process.platform !== 'win32')('[REQ-124] 完了ゲートの品質コマンドの途中で中断されたら、コマンドを止め、エンジンを呼ばずに summary.json に中断を書く', () =>
    withRepo(async (repo) => {
      repo.write('interrupt.cjs', INTERRUPT_SCRIPT);
      repo.write('loomake.config.json', JSON.stringify({ openspecValidate: false, commands: { test: 'node interrupt.cjs' } }));
      repo.write('.gitignore', '.loomake/test-report.json\npids.json\nfinished.txt\n');
      repo.git('add', '-A');
      repo.git('commit', '-q', '-m', '中断する test コマンド');
      repo.plan([{ write: { 'impl.txt': '実装\n' } }, noChange]);
      const start = Date.now();
      const r = await run(repo);
      expect(Date.now() - start).toBeLessThan(30_000);
      expect(r.code).toBe(1);
      // エンジンを呼んだのは 2 つのタスクだけで、完了ゲートの直しでは呼ばない
      expect(repo.calls()).toHaveLength(2);
      expect(summary(repo)).toMatchObject({ status: 'interrupted', reason: '中断されました', remainingTasks: ['3.1 `pnpm -s verify --change c1 --done` を通す'] });
      const pids: number[] = JSON.parse(readFileSync(join(repo.root, 'pids.json'), 'utf8'));
      expect(pids.filter((pid) => processState(pid) === 'running')).toEqual([]);
    }));
});

describe('依存と動作環境', () => {
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8'));

  it('[REQ-123] @loomake/runner の dependencies は core・kit・trace だけ', () => {
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(['@loomake/core', '@loomake/kit', '@loomake/trace']);
  });

  it('[REQ-142] @loomake/runner の engines.node は >=22.12.0', () => {
    expect(pkg.engines?.node).toBe('>=22.12.0');
  });
});

describe('完了ゲートのタスクの印', () => {
  const marked = ['## 1. 実装', '- [ ] 1.1 一つ目のタスク（REQ-012）', '', '## 3. 確認', `- [ ] 3.1 品質の確認を通す ${GATE_MARK}`, ''].join('\n');

  it('[REQ-100][REQ-136] 印のあるタスクは、文に verify と --done がなくてもエンジンに渡さず、合格したときに完了にする', () =>
    withRepo(
      async (repo) => {
        repo.plan([{ write: { 'impl.txt': '実装\n' } }]);
        const r = await run(repo);
        expect(r.code).toBe(0);
        expect(repo.calls()).toHaveLength(1);
        expect(repo.calls()[0].prompt).not.toContain('品質の確認');
        expect(tasksMd(repo)).toContain(`- [x] 3.1 品質の確認を通す ${GATE_MARK}`);
        expect(r.stdout).not.toContain('タスクの文から判定しました');
      },
      { tasks: marked },
    ));

  it('[REQ-100] 印のない旧書式のタスクもエンジンに渡さず、印を付けるよう案内する', () =>
    withRepo(async (repo) => {
      repo.plan(passing);
      const r = await run(repo);
      expect(r.code).toBe(0);
      for (const c of repo.calls()) expect(c.prompt).not.toContain('3.1');
      expect(r.stdout).toContain('完了ゲートのタスクを、タスクの文から判定しました：3.1 `pnpm -s verify --change c1 --done` を通す');
      expect(r.stdout).toContain(`行の末尾に ${GATE_MARK} を付けてください`);
    }));

  it('[REQ-100] 残ったタスクの表示と summary.json には、印を含めない', () =>
    withRepo(
      async (repo) => {
        repo.plan([noChange, { write: { 'fix.txt': '1' } }]);
        const r = await run(repo);
        expect(r.code).toBe(1);
        expect(r.stdout).toContain('直しの回数の上限（1 回）に達しました');
        expect(r.stdout).toContain('残ったタスク：\n  - 3.1 品質の確認を通す\n');
        expect(summary(repo).remainingTasks).toEqual(['3.1 品質の確認を通す']);
        expect(r.stdout).not.toContain('loomake:gate');
      },
      { tasks: marked, run: { maxFixes: 1 } },
    ));
});

describe('実行中の失敗', () => {
  it('[REQ-137] 始めたあとにコミットが git のフックで失敗したら、理由と残ったタスクを記録に書き、終了コード 1 で止まる', () =>
    withRepo(async (repo) => {
      const hook = join(repo.root, '.git', 'hooks', 'pre-commit');
      writeFileSync(hook, '#!/bin/sh\necho "フックで止めました" >&2\nexit 1\n');
      chmodSync(hook, 0o755);
      repo.plan(passing);
      const r = await run(repo);
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('loomake run を止めました：git の操作に失敗しました：git commit');
      expect(summary(repo)).toMatchObject({ status: 'stopped', doneTasks: [] });
      expect(summary(repo).reason).toContain('フックで止めました');
      expect(summary(repo).remainingTasks[0]).toBe('1.1 一つ目のタスク（REQ-012）');
    }));

  it('[REQ-137] git のリポジトリでなければ、実行の記録を作らずに使い方の誤り（終了コード 2）にする', () =>
    withRepo(async (repo) => {
      rmSync(join(repo.root, '.git'), { recursive: true, force: true });
      const r = await cli(repo);
      expect(r.code).toBe(2);
      expect(r.stderr).toContain('git の操作に失敗しました');
      expect(existsSync(join(repo.root, '.loomake/runs'))).toBe(false);
    }));
});


describe('証拠記録の再検証の期限', () => {
  it('[REQ-140] 二度目の品質コマンドも残り時間で止め、PRを作らない', () =>
    withRepo(async (repo) => {
      repo.write('impl.txt', 'ready');
      repo.write('.gitignore', '.loomake/test-report.json\n.loomake/once\n');
      const script = readFileSync(join(repo.root, 'write-report.mjs'), 'utf8');
      repo.write('write-report.mjs', script.replace("mkdirSync('.loomake', { recursive: true });", `mkdirSync('.loomake', { recursive: true });
if (existsSync('.loomake/once')) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
writeFileSync('.loomake/once', 'yes');`));
      repo.git('add', '-A');
      repo.git('commit', '-qm', 'record-timeout');
      const started = Date.now();
      let checks = 0;
      const result = await run(repo, { now: () => new Date(started + (checks++ < 2 ? 0 : 59_000)) });
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('実行時間の上限');
      expect(repo.prs()).toEqual([]);
      expect(summary(repo).status).toBe('stopped');
    }, { tasks: '- [x] implementation\n', run: { timeoutMinutes: 1 } }));
});

describe('run設定の入力境界', () => {
  it.each([null, [], 'run', 1, { maxFixes: 1.5 }, { maxFixes: Number.MAX_SAFE_INTEGER + 1 }, { maxFixes: 0 }, { timeoutMinutes: null }])(
    '[REQ-141] 不正なrun設定 %j を日本語の使い方エラーにする',
    (value) => withRepo(async (repo) => {
      repo.write('loomake.config.json', JSON.stringify({ run: value }));
      const result = await cli(repo, '--dry-run');
      expect(result.code).toBe(2);
      expect(result.stderr).toContain('loomake.config.json の run');
      expect(repo.calls()).toEqual([]);
    }),
  );

  it('[REQ-141] 正しい整数と正の小数の時間を受け付ける', () =>
    withRepo(async (repo) => {
      expect((await run(repo, { dryRun: true })).code).toBe(0);
    }, { run: { maxFixes: 2, timeoutMinutes: 0.5 } }));
});

describe('出力予算による停止', () => {
  it('[REQ-152][REQ-199] JSON出力が上限で切れても改行の後のトークンを記録へ残さない', () =>
    withRepo(async (repo) => {
      const token = 'ghp_' + 'x'.repeat(24);
      repo.plan([{ output: 'before\n' + token + ' after ' + 'x'.repeat(200) }]);
      const result = await run(repo);
      expect(result.code).toBe(1);
      const saved = readFileSync(join(runDir(repo), '01-output.json'), 'utf8');
      expect(saved).not.toContain(token);
      expect(saved).toContain('***');
      expect(Buffer.byteLength(saved)).toBeLessThanOrEqual(80);
    }, { run: { maxOutputBytes: 80 } }));
  it('[REQ-152] 大きな出力で停止し、タスクと変更を未完了のまま残す', () =>
    withRepo(async (repo) => {
      repo.plan([{ write: { 'impl.txt': '途中' }, output: 'x'.repeat(200) }]);
      const result = await run(repo);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('出力が上限');
      expect(tasksMd(repo)).toContain('- [ ] 1.1');
      expect(log(repo)).toEqual(['init']);
      expect(repo.prs()).toEqual([]);
      expect(summary(repo).reason).toContain('出力が上限');
      expect(Buffer.byteLength(readFileSync(join(runDir(repo), '01-output.json'), 'utf8'))).toBeLessThanOrEqual(64);
    }, { run: { maxOutputBytes: 64 } }));

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('[REQ-152] 不正な出力上限 %j を設定エラーにする', (maxOutputBytes) =>
    withRepo(async (repo) => {
      repo.write('loomake.config.json', JSON.stringify({ run: { maxOutputBytes } }));
      const result = await cli(repo);
      expect(result.code).toBe(2);
      expect(result.stderr).toContain('run.maxOutputBytes');
      expect(repo.calls()).toEqual([]);
    }));
});

describe('runnerの表示の保護', () => {
  const token = 'ghp_' + 'x'.repeat(24);

  it('[REQ-199] 追加された既知形式と隣接する秘密鍵を実際の出力記録で置換する', () =>
    withRepo(async (repo) => {
      const values = [
        'npm_' + 'x'.repeat(36), 'xoxb-' + 'x'.repeat(24), 'glpat-' + 'x'.repeat(24),
        'AIza' + 'X'.repeat(35), 'eyJ' + 'x'.repeat(12) + '.' + 'y'.repeat(12) + '.' + 'z'.repeat(12),
        'Z'.repeat(24),
      ];
      const key = '-----BEGIN PRIVATE KEY-----\nFAKE_PRIVATE_BODY\n-----END PRIVATE KEY-----';
      const text = values.slice(0, 5).join('\n') + '\nAuthorization: Bearer ' + values[5] + '\nsk-' + 'x'.repeat(24) + key;
      repo.plan([{ write: { 'impl.txt': 'ready' }, output: text }, noChange]);
      expect((await run(repo)).code).toBe(0);
      const output = readFileSync(join(runDir(repo), '01-output.json'), 'utf8');
      for (const value of [...values, 'FAKE_PRIVATE_BODY', '-----BEGIN PRIVATE KEY-----']) expect(output).not.toContain(value);
      expect(JSON.parse(output).result).toContain('Authorization: Bearer ***');
      expect(JSON.parse(output).result).toBe('***\n***\n***\n***\n***\nAuthorization: Bearer ***\n******');
      expect(output).toContain('***');
    }));

  it('[REQ-154] 質問と停止理由を表示する前に置換する', () =>
    withRepo(async (repo) => {
      repo.plan([{ output: `LOOMAKE-QUESTION: ${token} を確認してください` }]);
      const result = await run(repo);
      expect(result.code).toBe(1);
      expect(result.stdout).not.toContain(token);
      expect(result.stdout).toContain('***');
      expect(summary(repo).reason).not.toContain(token);
      expect(summary(repo).reason).toContain('***');
    }));

  it('[REQ-154] 品質コマンドの進捗を転送する前に置換する', () =>
    withRepo(async (repo) => {
      const config = JSON.parse(readFileSync(join(repo.root, 'loomake.config.json'), 'utf8'));
      config.commands.test += ` ${token}`;
      repo.write('loomake.config.json', JSON.stringify(config));
      repo.git('add', '-A');
      repo.git('commit', '-qm', 'synthetic marker');
      repo.plan(passing);
      const progress: string[] = [];
      expect((await run(repo, { progress: (text) => progress.push(text) })).code).toBe(0);
      expect(progress.join('\n')).not.toContain(token);
      expect(progress.join('\n')).toContain('***');
    }));
});


describe('実行の排他と記録', () => {
  it('[REQ-158] 二重起動は先の実行を変更せず、中断後はロックを解放する', () =>
    withRepo(async (repo) => {
      repo.plan([{ sleepMs: 10_000 }]);
      const controller = new AbortController();
      const first = run(repo, { signal: controller.signal });
      try {
        // Windows では run の準備に 1 秒以上かかり、vi.waitFor の既定の 1 秒に収まらない
        await vi.waitFor(() => expect(repo.calls()).toHaveLength(1), { timeout: 30_000, interval: 50 });
        const head = repo.git('rev-parse', 'HEAD');
        const tasks = tasksMd(repo);
        const dir = runDir(repo);
        const saved = readdirSync(dir).sort().map((name) => [name, readFileSync(join(dir, name), 'utf8')]);
        const second = await run(repo, { dryRun: true });
        expect(second.code).toBe(1);
        expect(second.stdout).toContain('同じ作業ツリーの実行ロック');
        expect(repo.calls()).toHaveLength(1);
        expect(repo.git('rev-parse', 'HEAD')).toBe(head);
        expect(tasksMd(repo)).toBe(tasks);
        expect(readdirSync(dir).sort().map((name) => [name, readFileSync(join(dir, name), 'utf8')])).toEqual(saved);
      } finally {
        controller.abort();
        await first;
      }
      expect(existsSync(join(repo.root, '.git/loomake-run.lock'))).toBe(false);
      expect((await run(repo, { dryRun: true })).code).toBe(0);
    }));

  it('[REQ-160] 同じ秒に再実行しても両方の理由とログを残す', () =>
    withRepo(async (repo) => {
      repo.plan([{ output: 'LOOMAKE-QUESTION: first stop' }, { output: 'LOOMAKE-QUESTION: second stop' }]);
      const now = () => new Date('2026-10-24T12:00:00Z');
      expect((await run(repo, { now })).code).toBe(1);
      expect((await run(repo, { now })).code).toBe(1);
      const base = join(repo.root, '.loomake/runs');
      const dirs = readdirSync(base).filter((name) => name !== '.gitignore');
      expect(dirs).toHaveLength(2);
      const reasons = dirs.map((dir) => (JSON.parse(readFileSync(join(base, dir, 'summary.json'), 'utf8')) as RunSummary).reason);
      expect(reasons.join('\n')).toContain('first stop');
      expect(reasons.join('\n')).toContain('second stop');
      const outputs = dirs.map((dir) => JSON.parse(readFileSync(join(base, dir, '01-output.json'), 'utf8')).result as string).sort();
      expect(outputs).toEqual(['LOOMAKE-QUESTION: first stop', 'LOOMAKE-QUESTION: second stop']);
    }));
});

describe('壊れた設定ファイル', () => {
  it('[REQ-193] loomake.config.json を JSON として読めなければ、エンジンを呼ばず、記録も作らずに終了コード 2 を返す', () =>
    withRepo(async (repo) => {
      writeFileSync(join(repo.root, 'loomake.config.json'), '{bad');
      const r = await cli(repo);
      expect(r.code).toBe(2);
      expect(r.stderr).toContain('loomake.config.json を読めません');
      expect(r.stderr).not.toContain('SyntaxError');
      expect(repo.calls()).toEqual([]);
      expect(existsSync(join(repo.root, '.loomake/runs'))).toBe(false);
    }));
});
