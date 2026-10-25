import { appendFileSync, chmodSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { RuntimeFailure, UsageError, runVerify } from '@loomake/kit';
import { main } from '../../cli/src/main.js';
import { withProcessBudget } from '../../kit/src/runtime/process.js';
import { runRecord } from '@loomake/trace';
import { runRun } from '@loomake/runner';
import { makeRepo, CHANGE, fakeCli, stallOf, type FakeCli, type FakeCliEvent, type Repo } from './helpers.js';

// git やコマンドのプロセスを何度も起動するので、マシンの負荷が高いと既定の 5 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

const DIAGNOSTIC_BYTES = 64 * 1024;
const diagnosticFile = (repo: Repo) => process.env.LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR
  ? join(process.env.LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR, `${basename(repo.base)}.jsonl`)
  : join(repo.base, 'budget-events.jsonl');
function diagnosticEvent(repo: Repo, event: string, details: object = {}): void {
  const file = diagnosticFile(repo);
  const used = existsSync(file) ? statSync(file).size : 0;
  if (used >= DIAGNOSTIC_BYTES) return;
  appendFileSync(file, Buffer.from(JSON.stringify({ event, at: Date.now(), ...details }) + '\n').subarray(0, DIAGNOSTIC_BYTES - used));
}
function diagnosticContext(repo: Repo, details: object, cli?: FakeCli): string {
  const file = diagnosticFile(repo);
  const value = JSON.stringify({ ...details, stalled: existsSync(join(repo.base, 'stalled')), events: existsSync(file) ? readFileSync(file, 'utf8') : '', fake: cli?.events() ?? [] });
  const context = Buffer.from(value).subarray(0, DIAGNOSTIC_BYTES).toString('utf8');
  const output = process.env.LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_FILE;
  if (output) writeFileSync(output, context, { flag: 'wx' });
  return context;
}
// 偽の CLI が狙った操作で止まり、それより前の本物への転送が起動に失敗していないことを、期限の検査より先に確かめる（REQ-240）
function expectStalled(cli: FakeCli, match: (args: string[]) => boolean, context: string) {
  const { stall, failedForwards } = stallOf(cli, match);
  expect(failedForwards, context).toEqual([]);
  expect(stall, context).toBeDefined();
  return stall!;
}
// 期限から止まるまでの猶予（windows-fake-clis の仮定 A-03）。監視役の SIGTERM から SIGKILL までの 250ms、子の終了を待つ最大 1 秒、
// Windows の taskkill の最大 1 秒と、親へ戻るまでの分
const STOP_GRACE_MS = 3000;
// 1 操作の期限で止める試験で、偽の CLI が止まる時間。期限に猶予を足した時間より長くし、偽の CLI が自分で終わったのではなく止められたと分かるようにする
const STALL_MS = 10_000;
// Date.now() と監視役の単調時計の丸めの差
const CLOCK_SLACK_MS = 50;
const OPERATION_MS = 500;
// 止まった印から止まるまでが、期限に猶予を足した時間より短いことを確かめる（REQ-240）
function expectStoppedSoon(stall: FakeCliEvent, endedAt: number, limitMs: number, context: string) {
  expect(endedAt - stall.at, context).toBeLessThan(limitMs + STOP_GRACE_MS);
}
const isLockGit = (args: string[]) => args[0] === 'rev-parse' && args.includes('--absolute-git-dir');
// process.env から外部操作を起動する trace・verify のために、偽の CLI の PATH と NODE_OPTIONS を移す
function useRepoEnv(repo: Repo): () => void {
  const saved = { PATH: process.env.PATH, NODE_OPTIONS: process.env.NODE_OPTIONS };
  process.env.PATH = repo.env.PATH;
  if (repo.env.NODE_OPTIONS === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = repo.env.NODE_OPTIONS;
  return () => { for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v; };
}
async function run(repo: Repo) {
  const out: string[] = [];
  const code = await runRun({ root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, stdout: (text) => out.push(text), env: repo.env, fileExists: () => false });
  return { code, stdout: out.join('\n') };
}
const budget = <T>(action: () => T) => withProcessBudget({ timeoutMs: 20_000, maxOperationMs: OPERATION_MS }, action);
const summary = (repo: Repo) => { const dir = join(repo.root, '.loomake/runs'); const run = readdirSync(dir).filter((s) => s !== '.gitignore').sort().at(-1)!; return JSON.parse(readFileSync(join(dir, run, 'summary.json'), 'utf8')); };

describe('runから外部操作までの期限', () => {
  it('[REQ-182][REQ-240] ロック取得のGitが止まったら変更と記録を作らない', async () => {
    const started = Date.now();
    const repo = makeRepo();
    diagnosticEvent(repo, 'fixture-ready', { elapsedMs: Date.now() - started });
    try {
      const before = repo.git('rev-parse', 'HEAD'); const cli = fakeCli(repo, 'git', { when: "args.includes('--absolute-git-dir')", stallMs: STALL_MS });
      // 開始前の制限エラーは実行時の失敗（close-cli-gaps で使い方の誤りから変更）
      diagnosticEvent(repo, 'run-start');
      const runStarted = Date.now();
      const error = await budget(() => run(repo)).catch((e: unknown) => e);
      const endedAt = Date.now();
      diagnosticEvent(repo, 'run-end', { elapsedMs: Date.now() - started });
      const context = diagnosticContext(repo, { error: String(error), elapsedMs: Date.now() - started }, cli);
      const stall = expectStalled(cli, isLockGit, context);
      // 1 操作の期限まで待ち、期限に猶予を足した時間のうちに止まった
      expect(endedAt - runStarted, context).toBeGreaterThanOrEqual(OPERATION_MS - CLOCK_SLACK_MS);
      expectStoppedSoon(stall, endedAt, OPERATION_MS, context);
      expect(error, context).toBeInstanceOf(RuntimeFailure);
      expect(error, context).not.toBeInstanceOf(UsageError);
      expect(existsSync(join(repo.base, 'stalled')), context).toBe(true);
      expect(repo.git('rev-parse', 'HEAD')).toBe(before);
      expect(repo.calls()).toEqual([]);
      expect(existsSync(join(repo.root, '.loomake/runs'))).toBe(false);
    } finally { repo.cleanup(); }
  });
  it('[REQ-182][REQ-240] 準備で使った時間を含めてエンジンの期限を制限する', async () => {
    // 準備の gh auth status を PREP_DELAY_MS だけ遅らせ、エンジンに予算を最初から与え直すと上限を超えるようにする。
    // 予算は、Windows の遅い準備（約 1.4 秒）と遅らせた分を足してもエンジンを呼べる長さにする。
    // 猶予は元の試験（予算 1200ms・上限 2500ms）と同じ 1300ms にし、遅らせる時間をそれより長くする
    const BUDGET_MS = 8000;
    const PREP_DELAY_MS = 2000;
    const ENGINE_GRACE_MS = 1300;
    const repo = makeRepo();
    try {
      repo.plan([{ sleepMs: 30_000, write: { 'late.txt': '遅い変更' } }]);
      const cli = fakeCli(repo, 'gh', { when: "args[0]==='auth'", delayMs: PREP_DELAY_MS });
      const start = Date.now();
      const result = await withProcessBudget({ timeoutMs: BUDGET_MS }, () => run(repo));
      const elapsed = Date.now() - start;
      const context = diagnosticContext(repo, { elapsed, stdout: result.stdout }, cli);
      // 準備を遅らせ、転送が成功し、エンジンまで届いた
      const events = cli.events();
      const delayed = events.findIndex((e) => e.event === 'delay-start' && e.args[0] === 'auth');
      expect(delayed, context).toBeGreaterThanOrEqual(0);
      expect(events.slice(delayed).find((e) => e.event === 'forward-end'), context).toMatchObject({ status: 0 });
      expect(events.filter((e) => e.event === 'forward-end' && e.error), context).toEqual([]);
      expect(repo.calls(), context).toHaveLength(1);
      expect(result.code, context).toBe(1);
      expect(result.stdout, context).toContain('実行時間の上限');
      // 予算まで待ち、予算に猶予を足した時間のうちに止まった。準備の分を予算から引いていなければ、PREP_DELAY_MS の分だけ上限を超える
      expect(elapsed, context).toBeGreaterThanOrEqual(BUDGET_MS - CLOCK_SLACK_MS);
      expect(elapsed, context).toBeLessThan(BUDGET_MS + ENGINE_GRACE_MS);
      expect(existsSync(join(repo.root, 'late.txt'))).toBe(false);
      expect(repo.prs()).toEqual([]);
    } finally { repo.cleanup(); }
  });
  it('[REQ-182] 検証がtasks.mdを変えたら上書きせず停止する', async () => {
    const repo = makeRepo();
    try {
      repo.write('write-report.mjs', "import { appendFileSync } from 'node:fs'; appendFileSync('openspec/changes/c1/tasks.md','変更された内容');");
      repo.git('add', 'write-report.mjs'); repo.git('commit', '-qm', '品質コマンドの変更');
      repo.plan([{}, {}]);
      const result = await run(repo);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('tasks.mdが変わりました');
      expect(readFileSync(join(repo.root, 'openspec/changes/c1/tasks.md'), 'utf8')).toContain('変更された内容');
      expect(repo.prs()).toEqual([]);
      expect(repo.git('log', '-1', '--format=%s')).not.toContain('完了ゲートに合格');
    } finally { repo.cleanup(); }
  });
  it('[REQ-116][REQ-182][REQ-240] 事前の認証確認が期限切れなら実装も記録も始めない', async () => {
    const repo = makeRepo();
    try {
      const before = repo.git('rev-parse', 'HEAD');
      const cli = fakeCli(repo, 'gh', { when: "args[0]==='auth'", stallMs: STALL_MS });
      const error = await budget(() => run(repo)).catch((value: unknown) => value);
      const endedAt = Date.now();
      const context = diagnosticContext(repo, { error: String(error) }, cli);
      expectStoppedSoon(expectStalled(cli, (args) => args[0] === 'auth', context), endedAt, OPERATION_MS, context);
      expect(error).toBeInstanceOf(RuntimeFailure);
      expect(error).not.toBeInstanceOf(UsageError);
      expect(String(error)).toContain('実行時間の上限');
      expect(existsSync(join(repo.base, 'stalled'))).toBe(true);
      expect(repo.calls()).toEqual([]);
      expect(repo.git('rev-parse', 'HEAD')).toBe(before);
      expect(repo.git('branch', '--list', 'loomake/c1')).toBe('');
      expect(existsSync(join(repo.root, '.loomake/runs'))).toBe(false);
      expect(repo.prs()).toEqual([]);
    } finally { repo.cleanup(); }
  });
  // authは事前確認を通した後、実装の完了後に行う公開前の確認だけを止める。
  it.each(['push', 'auth', 'list', 'create'] as const)('[REQ-182][REQ-240] %sの期限後に先へ進まず、再実行で重複させない', async (stage) => {
    const started = Date.now();
    const repo = makeRepo();
    diagnosticEvent(repo, 'fixture-ready', { elapsedMs: Date.now() - started, stage });
    try {
      repo.plan([{ write: { 'impl.txt': '実装' } }, {}]);
      const command = stage === 'push' ? 'git' : 'gh';
      const condition = stage === 'push' ? "args[0]==='push'" : stage === 'auth' ? "args[0]==='auth' && fs.existsSync('impl.txt')" : `args[0]==='pr' && args[1]===${JSON.stringify(stage)}`;
      // push と PR の作成は 1 操作の期限では止めず、run の残り時間で止める（relax-commit-push-budget）。
      // そこで、この 2 つは run 全体の予算より長く止め、全体の期限で止まることを確かめる
      const untilDeadline = stage === 'push' || stage === 'create';
      // 共有の期限は、負荷の高い CI でも証拠の記録（verify を含む）が終わって push・create の停止に届き、そこから 1 操作の期限より長く待てる長さにする。
      // 短いと、証拠の記録の中で期限に当たって同じ「実行時間の上限」で止まり、確かめたい停止に届かない。
      // Windows は外部操作の起動が遅く、偽の git を通すと node の起動も増えるので、長くする（windows-fake-clis）
      const SHARED_DEADLINE_MS = process.platform === 'win32' ? 40_000 : 12_000;
      const UNTIL_DEADLINE_OPERATION_MS = 5_000;
      const cli = fakeCli(repo, command, { when: condition, forwardFirst: stage === 'create', stallMs: untilDeadline ? SHARED_DEADLINE_MS + 30_000 : STALL_MS });
      diagnosticEvent(repo, 'run-start', { stage });
      // untilDeadline の 2 つは、止まる手前の通常の git・gh が負荷で遅れても 1 操作の期限に当たらないよう余裕を持たせ、
      // 止まったのが共有の期限であることは所要時間の下限で確かめる。
      const runStarted = Date.now();
      const result = await (untilDeadline ? withProcessBudget({ timeoutMs: SHARED_DEADLINE_MS, maxOperationMs: UNTIL_DEADLINE_OPERATION_MS }, () => run(repo)) : budget(() => run(repo)));
      const endedAt = Date.now();
      const runElapsed = endedAt - runStarted;
      diagnosticEvent(repo, 'run-end', { stage, code: result.code, elapsedMs: Date.now() - started });
      const context = diagnosticContext(repo, { stage, code: result.code, elapsedMs: Date.now() - started, stdout: result.stdout }, cli);
      // 期限の検査の前に、狙った段階（push・2 回目の auth・PR の検索・作成）で止まったことを確かめる
      const stall = expectStalled(cli, (args) => (stage === 'push' ? args[0] === 'push' : stage === 'auth' ? args[0] === 'auth' : args[0] === 'pr' && args[1] === stage), context);
      expect(result.code, context).toBe(1);
      if (untilDeadline) {
        // 1 操作の期限より長く待ち、共有の期限まで待って、共有の期限に猶予を足した時間のうちに止まった
        expect(endedAt - stall.at, context).toBeGreaterThan(UNTIL_DEADLINE_OPERATION_MS);
        expect(runElapsed, context).toBeGreaterThanOrEqual(SHARED_DEADLINE_MS - 500);
        expect(runElapsed, context).toBeLessThan(SHARED_DEADLINE_MS + STOP_GRACE_MS);
      } else expectStoppedSoon(stall, endedAt, OPERATION_MS, context);
      expect(result.stdout, context).toContain('実行時間の上限');
      expect(summary(repo).status, context).toBe('stopped');
      // 止まったのが確かめたい段階（push・create の停止）であることを、停止の印で確かめる
      if (untilDeadline) expect(existsSync(join(repo.base, 'stalled')), context).toBe(true);
      expect(readFileSync(join(repo.root, 'impl.txt'), 'utf8')).toBe('実装');
      expect(repo.prs(), context).toHaveLength(stage === 'create' ? 1 : 0);
      const evidenceDir = join(repo.root, '.loomake/evidence', CHANGE);
      if (stage !== 'auth') expect(readdirSync(evidenceDir)).toHaveLength(1);
      if (stage === 'push') expect(existsSync(repo.env.FAKE_GH_LOOKUP_LOG!)).toBe(false);
      // 元のコマンドへ戻し、通常の再試行で同じ証拠・PRを再利用する。
      cli.restore();
      const retry = await run(repo);
      expect(retry.code, retry.stdout).toBe(0);
      expect(repo.prs()).toHaveLength(1);
      expect(readdirSync(evidenceDir)).toHaveLength(1);
      expect(repo.calls()).toHaveLength(2);
    } finally { repo.cleanup(); }
  }, process.platform === 'win32' ? 120_000 : 45_000);
});

describe('verifyとtraceの期限', () => {
  it('[REQ-183][REQ-240] traceのGitも共有予算で止める', () => {
    const repo = makeRepo();
    const cli = fakeCli(repo, 'git', { when: "args[0]==='status'", stallMs: STALL_MS });
    const restoreEnv = useRepoEnv(repo);
    try {
      const error = (() => { try { budget(() => runRecord({ root: repo.root, changeId: CHANGE, stdout: () => {} })); } catch (e) { return e; } })();
      const endedAt = Date.now();
      const context = diagnosticContext(repo, { error: String(error) }, cli);
      expectStoppedSoon(expectStalled(cli, (args) => args[0] === 'status', context), endedAt, OPERATION_MS, context);
      expect(() => { throw error; }).toThrow('実行時間の上限');
      expect(existsSync(join(repo.root, '.loomake/evidence'))).toBe(false);
    } finally { restoreEnv(); repo.cleanup(); }
  });
  it('[REQ-183][REQ-240] OpenSpec検証の時間切れをCLI不存在と区別する', () => {
    const repo = makeRepo();
    const cli = fakeCli(repo, 'openspec', { when: 'true', stallMs: STALL_MS });
    const restoreEnv = useRepoEnv(repo);
    try {
      repo.write('loomake.config.json', JSON.stringify({ openspecValidate: 'auto', commands: {} }));
      const result = budget(() => runVerify({ root: repo.root, changeId: CHANGE, gate: 'spec-only' }));
      const endedAt = Date.now();
      const context = diagnosticContext(repo, { results: result.results }, cli);
      expectStoppedSoon(expectStalled(cli, (args) => args[0] === 'validate', context), endedAt, OPERATION_MS, context);
      expect(result.ok).toBe(false);
      expect(result.results.find((r) => r.check === 'openspec validate')).toMatchObject({ status: 'fail', detail: expect.stringContaining('実行時間の上限') });
    } finally { restoreEnv(); repo.cleanup(); }
  });
  it('[REQ-183] 品質コマンドの中断後に次のコマンドを実行しない', () => {
    const repo = makeRepo();
    try {
      repo.write('loomake.config.json', JSON.stringify({ openspecValidate: false, commands: { lint: `node -e "process.kill(process.ppid,'SIGINT');setInterval(()=>{},100)"`, test: `node -e "require('node:fs').writeFileSync('after','x')"` } }));
      // shellの親ではなく監視役へ送るため、shellからexecでNodeへ置き換える。
      const config = JSON.parse(readFileSync(join(repo.root, 'loomake.config.json'), 'utf8')); config.commands.lint = 'exec ' + config.commands.lint;
      repo.write('loomake.config.json', JSON.stringify(config));
      const result = withProcessBudget({ timeoutMs: 3000 }, () => runVerify({ root: repo.root }));
      expect(result.results.find((r) => r.check === 'command: lint')).toMatchObject({ status: 'fail', detail: expect.stringContaining('中断') });
      expect(result.results.find((r) => r.check === 'command: test')).toMatchObject({ status: 'fail', detail: expect.stringContaining('中断') });
      expect(existsSync(join(repo.root, 'after'))).toBe(false);
    } finally { repo.cleanup(); }
  });
  it('[REQ-183] 明示したtimeoutMsがなくても共有期限で品質コマンドを止める', () => {
    const repo = makeRepo();
    try {
      repo.write('loomake.config.json', JSON.stringify({ openspecValidate: false, commands: { test: 'node -e "setTimeout(()=>{},3000)"' } }));
      const result = withProcessBudget({ timeoutMs: 500 }, () => runVerify({ root: repo.root }));
      expect(result.results.find((r) => r.check === 'command: test')).toMatchObject({ status: 'fail', detail: expect.stringContaining('実行時間の上限') });
    } finally { repo.cleanup(); }
  });
});

describe('実行時の失敗の終了コード', () => {
  it('[REQ-192][REQ-182][REQ-240] run の準備中に git が時間の上限で止まると、使い方を出さずに終了コード 3 を返す', async () => {
    const RUN_TIMEOUT_MS = 1200;
    const repo = makeRepo({ run: { timeoutMinutes: RUN_TIMEOUT_MS / 60_000 } });
    const saved = { ...process.env };
    try {
      const cli = fakeCli(repo, 'git', { when: "args.includes('--absolute-git-dir')", stallMs: STALL_MS });
      Object.assign(process.env, repo.env);
      const out: string[] = [];
      const err: string[] = [];
      const runStarted = Date.now();
      const code = await main(['run', '--change', CHANGE], { cwd: repo.root, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
      const endedAt = Date.now();
      const context = diagnosticContext(repo, { code, stderr: err.join('\n') }, cli);
      const stall = expectStalled(cli, isLockGit, context);
      // run の期限（timeoutMinutes 0.02 = 1200ms）まで待ち、期限に猶予を足した時間のうちに止まった
      expect(endedAt - runStarted, context).toBeGreaterThanOrEqual(RUN_TIMEOUT_MS - CLOCK_SLACK_MS);
      expectStoppedSoon(stall, endedAt, RUN_TIMEOUT_MS, context);
      expect(code).toBe(3);
      expect(err.join('\n')).toContain('loomake run: 外部操作を止めました');
      expect(err.join('\n')).not.toContain('使い方:');
      expect(existsSync(join(repo.root, '.loomake/runs'))).toBe(false);
    } finally {
      for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
      repo.cleanup();
    }
  });
});

describe('フックを動かす git の操作の期限', () => {
  it('[REQ-182] 1 操作の期限より遅い pre-commit・pre-push のフックがあっても、run の残り時間の中でコミット・push・PR の作成まで進む', async () => {
    const repo = makeRepo();
    try {
      for (const name of ['pre-commit', 'pre-push']) {
        const hook = join(repo.root, '.git', 'hooks', name);
        writeFileSync(hook, '#!/bin/sh\nsleep 1\n');
        chmodSync(hook, 0o755);
      }
      repo.plan([{ write: { 'impl.txt': '実装\n' } }, {}]);
      const r = await budget(() => run(repo));
      expect(r.code, r.stdout).toBe(0);
      expect(summary(repo)).toMatchObject({ status: 'completed', remainingTasks: [] });
      expect(repo.prs()).toHaveLength(1);
    } finally { repo.cleanup(); }
  }, 60_000);
});
