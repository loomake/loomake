import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { RuntimeFailure, UsageError, runVerify, verifyExitCode } from '@loomake/kit';
import { main } from '../../cli/src/main.js';
import { withProcessBudget } from '../../kit/src/runtime/process.js';
import { runRecord } from '@loomake/trace';
import { checkOf, makeRepo, noChange, CHANGE, signalSupervisorScript, fakeCli, type Repo } from './helpers.js';
import { CLOCK_SLACK_MS, OPERATION_MS, STALL_MS, diagnosticContext, diagnosticEvent, expectStalled, expectStoppedSoon, run } from './external-budget-helpers.js';

// git やコマンドのプロセスを何度も起動するので、マシンの負荷が高いと既定の 5 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

const isLockGit = (args: string[]) => args[0] === 'rev-parse' && args.includes('--absolute-git-dir');
// process.env から外部操作を起動する trace・verify のために、偽の CLI の PATH と NODE_OPTIONS を移す
function useRepoEnv(repo: Repo): () => void {
  const saved = { PATH: process.env.PATH, NODE_OPTIONS: process.env.NODE_OPTIONS };
  process.env.PATH = repo.env.PATH;
  if (repo.env.NODE_OPTIONS === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = repo.env.NODE_OPTIONS;
  return () => { for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v; };
}
const budget = <T>(action: () => T) => withProcessBudget({ timeoutMs: 20_000, maxOperationMs: OPERATION_MS }, action);

describe('runから外部操作までの期限', () => {
  it('[REQ-182] ロック取得のGitが止まったら変更と記録を作らない', async () => {
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
  it('[REQ-182] 検証がtasks.mdを変えたら上書きせず停止する', async () => {
    const repo = makeRepo();
    try {
      repo.write('write-report.mjs', "import { appendFileSync } from 'node:fs'; appendFileSync('openspec/changes/c1/tasks.md','変更された内容');");
      repo.git('add', 'write-report.mjs'); repo.git('commit', '-qm', '品質コマンドの変更');
      repo.plan([noChange, noChange]);
      const result = await run(repo);
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('tasks.mdが変わりました');
      expect(readFileSync(join(repo.root, 'openspec/changes/c1/tasks.md'), 'utf8')).toContain('変更された内容');
      expect(repo.prs()).toEqual([]);
      expect(repo.git('log', '-1', '--format=%s')).not.toContain('完了ゲートに合格');
    } finally { repo.cleanup(); }
  });
  it('[REQ-116][REQ-182] 事前の認証確認が期限切れなら実装も記録も始めない', async () => {
    // Windows の gh は cmd.exe から偽の CLI の node を起動するので、500ms では偽の CLI が印を書く前に期限に当たることがあった
    // （main の run 40617269029 で、偽の CLI のイベントが空のまま「実行時間の上限」で止まった）。
    // そこで Windows では 1 操作の期限を、auth・list の段階の試験と同じ 2 秒にする。偽の CLI は STALL_MS 止まるので、期限で止めたことは変わらない
    const operationMs = process.platform === 'win32' ? 2_000 : OPERATION_MS;
    const repo = makeRepo();
    try {
      const before = repo.git('rev-parse', 'HEAD');
      const cli = fakeCli(repo, 'gh', { when: "args[0]==='auth'", stallMs: STALL_MS });
      const error = await withProcessBudget({ timeoutMs: 20_000, maxOperationMs: operationMs }, () => run(repo)).catch((value: unknown) => value);
      const endedAt = Date.now();
      const context = diagnosticContext(repo, { error: String(error) }, cli);
      expectStoppedSoon(expectStalled(cli, (args) => args[0] === 'auth', context), endedAt, operationMs, context);
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
});

// leftovers が後片付け失敗時の診断に使う、Windows の PID・親 PID・コマンドラインの一覧。
const PS_LIST = 'Get-CimInstance Win32_Process | ForEach-Object { "{0}`t{1}`t{2}" -f $_.ProcessId, $_.ParentProcessId, $_.CommandLine }';

function alive(pid: number) {
  try {
    process.kill(pid, 0);
    if (process.platform === 'linux' && /\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8'))) return false;
    return true;
  } catch { return false; }
}

/** コマンドラインに word を含む、生きているプロセスの一覧（後片付けに失敗したときの手がかり） */
function leftovers(word: string): string {
  const listing = process.platform === 'win32'
    ? spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', PS_LIST], { encoding: 'utf8', windowsHide: true }).stdout
    : spawnSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8' }).stdout;
  return (listing ?? '').split(/\r?\n/).filter((line) => line.includes(word) && !line.includes('powershell')).join('\n') || 'なし';
}

describe('verifyとtraceの期限', () => {
  it('[REQ-183] traceのGitも共有予算で止める', () => {
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
  it('[REQ-183] OpenSpec検証の時間切れをCLI不存在と区別する', () => {
    const repo = makeRepo();
    const cli = fakeCli(repo, 'openspec', { when: 'true', stallMs: STALL_MS });
    const restoreEnv = useRepoEnv(repo);
    try {
      repo.write('loomake.config.json', JSON.stringify({ openspecValidate: 'auto', commands: {} }));
      const result = budget(() => runVerify({ root: repo.root, changeId: CHANGE, gate: 'spec-only' }));
      const endedAt = Date.now();
      const context = diagnosticContext(repo, { checks: result.run.status === 'aborted' ? [] : result.checks }, cli);
      expectStoppedSoon(expectStalled(cli, (args) => args[0] === 'validate', context), endedAt, OPERATION_MS, context);
      expect(verifyExitCode(result)).toBe(1);
      expect(checkOf(result, 'openspec validate')).toMatchObject({ status: 'fail', detail: expect.stringContaining('実行時間の上限') });
    } finally { restoreEnv(); repo.cleanup(); }
  });
  it('[REQ-183][REQ-250] 品質コマンドの中断後に次のコマンドを実行しない', () => {
    const repo = makeRepo();
    let failure: unknown;
    try {
      // shell の親ではなく監視役へ送る。POSIX の exec は cmd.exe にないので、祖先をたどって監視役を見つけ、送った先を記録する。
      // Windows で別のプロセスから送る SIGINT は監視役の強制終了になり、結果を書かずに終わった監視役の扱い（REQ-250）を通る
      repo.write('send-sigint.cjs', signalSupervisorScript('SIGINT'));
      repo.write('loomake.config.json', JSON.stringify({ openspecValidate: false, commands: { lint: 'node send-sigint.cjs', test: `node -e "require('node:fs').writeFileSync('after','x')"` } }));
      // 祖先の一覧を Windows の PowerShell で読むと数秒かかるので、期限は中断より十分長くする。期限で止まると「中断」を含まず、この試験は落ちる
      const result = withProcessBudget({ timeoutMs: 30_000 }, () => runVerify({ root: repo.root }));
      const receipt = join(repo.root, 'interrupted.json');
      expect(existsSync(receipt), JSON.stringify(result)).toBe(true);
      const sent = JSON.parse(readFileSync(receipt, 'utf8')) as { pid?: number; command?: string; self?: number; error?: string };
      expect(sent).toMatchObject({ command: expect.stringMatching(/[\\/]supervisor\.cjs|^loomake: command supervisor/) });
      // 中断で止めた品質コマンドは不足と実行エラー（partial）にする（verify-v2-wiring の仮定 A-03）
      expect(checkOf(result, 'command: lint')).toMatchObject({ status: 'insufficient', detail: expect.stringContaining('中断') });
      expect(checkOf(result, 'command: test')).toMatchObject({ status: 'insufficient', detail: expect.stringContaining('中断') });
      expect(result.run.status).toBe('partial');
      expect(existsSync(join(repo.root, 'after'))).toBe(false);
      // SIGINT を送った品質コマンド自身も、止めてから返す（REQ-181・REQ-250）
      expect(alive(sent.self!), JSON.stringify(sent)).toBe(false);
    } catch (error) {
      failure = error;
    }
    // 後片付けの失敗で、先の検査の失敗を隠さない。残ったプロセスがあれば一緒に示す
    try { repo.cleanup(); }
    catch (error) { throw new Error(`後片付けに失敗しました：${String(error)}\n先の失敗：${String(failure)}\n残ったプロセス：${leftovers('send-sigint')}`, { cause: error }); }
    if (failure !== undefined) throw failure as Error;
  });
  it('[REQ-183] 明示したtimeoutMsがなくても共有期限で品質コマンドを止める', () => {
    const repo = makeRepo();
    try {
      repo.write('loomake.config.json', JSON.stringify({ openspecValidate: false, commands: { test: 'node -e "setTimeout(()=>{},3000)"' } }));
      const result = withProcessBudget({ timeoutMs: 500 }, () => runVerify({ root: repo.root }));
      expect(checkOf(result, 'command: test')).toMatchObject({ status: 'insufficient', detail: expect.stringContaining('実行時間の上限') });
      expect(result.run.status).toBe('partial');
    } finally { repo.cleanup(); }
  });
});

describe('実行時の失敗の終了コード', () => {
  it('[REQ-192][REQ-182] run の準備中に git が時間の上限で止まると、使い方を出さずに終了コード 3 を返す', async () => {
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
