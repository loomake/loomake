import { appendFileSync, chmodSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { RuntimeFailure, UsageError, runVerify } from '@loomake/kit';
import { main } from '../../cli/src/main.js';
import { profileEvent } from '../../../scripts/test-phase-profile.mjs';
import { holderWaitTime, withProcessBudget } from '../../kit/src/runtime/process.js';
import { runRecord } from '@loomake/trace';
import { runRun } from '@loomake/runner';
import { makeRepo, noChange, CHANGE, fakeCli, stallOf, type FakeCli, type FakeCliEvent, type Repo } from './helpers.js';

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
// 偽の CLI が狙った操作で止まり、それより前の本物への転送が起動に失敗していないことを、期限の検査より先に確かめる（docs/dev/testing-across-os.md）
function expectStalled(cli: FakeCli, match: (args: string[]) => boolean, context: string) {
  const { stall, failedForwards } = stallOf(cli, match);
  expect(failedForwards, context).toEqual([]);
  expect(stall, context).toBeDefined();
  // シグナルで終わった転送も、止まる前の操作の失敗として扱う（main の expectStalledAt から引き継ぐ）
  const events = cli.events();
  const index = events.findIndex((e) => e.event === 'stall-start' && match(e.args));
  expect(events.slice(0, index).filter((e) => e.event === 'forward-end' && e.signal), context).toEqual([]);
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
// 止まった印から止まるまでが、期限に猶予を足した時間より短いことを確かめる（docs/dev/testing-across-os.md）
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
  it('[REQ-182] 準備で使った時間を含めてエンジンの期限を制限する', async () => {
    // 準備の gh auth status を PREP_DELAY_MS だけ遅らせ、エンジンに予算を最初から与え直すと上限を超えるようにする。
    // 予算は、Windows の遅い準備（約 1.4 秒）と遅らせた分を足してもエンジンを呼べる長さにする。
    // 猶予は元の試験（予算 1200ms・上限 2500ms）と同じ 1300ms にし、遅らせる時間をそれより長くする。
    // Windows では、期限で git を止めるのに taskkill を使うので、止まるまでに 2 秒近くかかることがある（PR #43 の run 40612195551 で 1983ms）。
    // そこで Windows では猶予を 3000ms にし、遅らせる時間をそれより長い 4000ms にして、準備の分を引き忘れたら上限を超えることを保つ
    const BUDGET_MS = 8000;
    const PREP_DELAY_MS = process.platform === 'win32' ? 4000 : 2000;
    const ENGINE_GRACE_MS = process.platform === 'win32' ? 3000 : 1300;
    const repo = makeRepo();
    try {
      repo.plan([{ sleepMs: 30_000, write: { 'late.txt': '遅い変更' } }]);
      const cli = fakeCli(repo, 'gh', { when: "args[0]==='auth'", delayMs: PREP_DELAY_MS });
      const start = Date.now();
      const waitedBefore = holderWaitTime();
      const result = await withProcessBudget({ timeoutMs: BUDGET_MS }, () => run(repo));
      // Windows の保持役の準備を待った時間は予算に含めない（REQ-257）ので、経過時間からも除く
      const elapsed = Date.now() - start - (holderWaitTime() - waitedBefore);
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
  // authは事前確認を通した後、実装の完了後に行う公開前の確認だけを止める。
  it.each(['push', 'auth', 'list', 'create'] as const)('[REQ-182][REQ-297] %sの期限後に先へ進まず、再実行で重複させない', async (stage) => {
    const caseId = stage === 'push' || stage === 'create' ? `deadline-${stage}` : undefined;
    const profile = (event: string, details: object = {}) => profileEvent(caseId, event, details);
    profile('test-start');
    let outcome = 'failed';
    try {
      const started = Date.now();
      const repo = makeRepo();
      diagnosticEvent(repo, 'fixture-ready', { elapsedMs: Date.now() - started, stage });
      try {
        repo.plan([{ write: { 'impl.txt': '実装' } }, noChange]);
        const command = stage === 'push' ? 'git' : 'gh';
        const condition = stage === 'push' ? "args[0]==='push'" : stage === 'auth' ? "args[0]==='auth' && fs.existsSync('impl.txt')" : `args[0]==='pr' && args[1]===${JSON.stringify(stage)}`;
        // push と PR の作成は 1 操作の期限では止めず、run の残り時間で止める（relax-commit-push-budget）。
        // そこで、この 2 つは run 全体の予算より長く止め、全体の期限で止まることを確かめる
        const untilDeadline = stage === 'push' || stage === 'create';
        // 共有の期限は、負荷の高い CI でも証拠の記録（verify を含む）が終わって push・create の停止に届き、そこから 1 操作の期限より長く待てる長さにする。
        // 短いと、証拠の記録の中で期限に当たって同じ「実行時間の上限」で止まり、確かめたい停止に届かない。
        // 止まった印から 1 操作の期限（5 秒）より長く待てるよう、macOS の CI で push に届いた時刻（約 7.4 秒）に余裕を足して 20 秒にする。
        // Windows は外部操作の起動が遅く、偽の git を通すと node の起動も増えるので、さらに長くする（windows-fake-clis）
        const SHARED_DEADLINE_MS = process.platform === 'win32' ? 40_000 : 20_000;
        const UNTIL_DEADLINE_OPERATION_MS = 5_000;
        // auth・list は 1 操作の期限で止める。止まる手前の通常の git・gh が負荷で 500ms を超えると、狙った段階の前で止まる
        // （macOS の CI で、印の検査が見つけた）。そこで 1 操作の期限を 2 秒にし、止まった印から期限 + 猶予のうちに止まることを確かめる
        const STAGE_OPERATION_MS = 2_000;
        // 1 操作の期限には監視役と偽の CLI の起動時間も入るので、止まった印からの時間は期限より短くなりうる（main の PR #23 から引き継ぐ）
        const OPERATION_SLACK_MS = 1_000;
        const cli = fakeCli(repo, command, { when: condition, forwardFirst: stage === 'create', stallMs: untilDeadline ? SHARED_DEADLINE_MS + 30_000 : STALL_MS });
        diagnosticEvent(repo, 'run-start', { stage });
        // untilDeadline の 2 つは、止まる手前の通常の git・gh が負荷で遅れても 1 操作の期限に当たらないよう余裕を持たせ、
        // 止まったのが共有の期限であることは所要時間の下限で確かめる。
        const runStarted = Date.now();
        const waitedBefore = holderWaitTime();
        const clockStart = caseId && process.env.LOOMAKE_TEST_BUDGET_CLOCK === '1'
          ? { wall: performance.now(), holder: holderWaitTime() } : undefined;
        profile('run-start', { at: runStarted });
        // auth・list は 1 操作の期限で止まることを確かめる。run の予算は狙った段階に届くための長さで、Windows では外部操作ごとに保持役へ保持を頼む分だけ
        // 遅くなり、20 秒では list に届く前に尽きることがあった（run 40634806172 の再実行）。そこで Windows では 35 秒にする
        const stageBudgetMs = process.platform === 'win32' ? 35_000 : 20_000;
        const result = await withProcessBudget(untilDeadline ? { timeoutMs: SHARED_DEADLINE_MS, maxOperationMs: UNTIL_DEADLINE_OPERATION_MS } : { timeoutMs: stageBudgetMs, maxOperationMs: STAGE_OPERATION_MS }, () => run(repo));
        const endedAt = Date.now();
        const budgetClock = clockStart ? {
          at: endedAt, wallElapsedMs: performance.now() - clockStart.wall,
          holderWaitMs: holderWaitTime() - clockStart.holder,
          budgetMs: SHARED_DEADLINE_MS, graceMs: STOP_GRACE_MS,
        } : undefined;
        profile('run-end', { at: endedAt });
        if (budgetClock) profile('budget-clock', budgetClock);
        // 保持役の準備待ちは共有予算に含めないため、判定の経過時間からも除く（REQ-257）。
        const runElapsed = endedAt - runStarted - (holderWaitTime() - waitedBefore);
        diagnosticEvent(repo, 'run-end', { stage, code: result.code, elapsedMs: Date.now() - started });
        const context = diagnosticContext(repo, { stage, code: result.code, elapsedMs: Date.now() - started, stdout: result.stdout }, cli);
        // 期限の検査の前に、狙った段階（push・2 回目の auth・PR の検索・作成）で止まったことを確かめる
        const operation = { push: ['push'], auth: ['auth', 'status'], list: ['pr', 'list'], create: ['pr', 'create'] }[stage];
        const stall = expectStalled(cli, (args) => operation.every((value, i) => args[i] === value), context);
        profile('stall-start', { at: stall.at });
        expect(result.code, context).toBe(1);
        if (untilDeadline) {
          // 1 操作の期限より長く待ち、共有の期限まで待って、共有の期限に猶予を足した時間のうちに止まった
          expect(endedAt - stall.at, context).toBeGreaterThan(UNTIL_DEADLINE_OPERATION_MS);
          expect(runElapsed, context).toBeGreaterThanOrEqual(SHARED_DEADLINE_MS - 500);
          expect(runElapsed, context).toBeLessThan(SHARED_DEADLINE_MS + STOP_GRACE_MS);
        } else {
          // 共有の期限ではなく 1 操作の期限まで待ってから止まった
          expect(endedAt - stall.at, context).toBeGreaterThanOrEqual(STAGE_OPERATION_MS - OPERATION_SLACK_MS);
          expectStoppedSoon(stall, endedAt, STAGE_OPERATION_MS, context);
        }
        expect(result.stdout, context).toContain('実行時間の上限');
        expect(summary(repo).status, context).toBe('stopped');
        expect(readFileSync(join(repo.root, 'impl.txt'), 'utf8')).toBe('実装');
        expect(repo.prs(), context).toHaveLength(stage === 'create' ? 1 : 0);
        const evidenceDir = join(repo.root, '.loomake/evidence', CHANGE);
        if (stage !== 'auth') expect(readdirSync(evidenceDir)).toHaveLength(1);
        if (stage === 'push') expect(existsSync(repo.env.FAKE_GH_LOOKUP_LOG!)).toBe(false);
        // 元のコマンドへ戻し、通常の再試行で同じ証拠・PRを再利用する。
        cli.restore();
        profile('retry-start');
        const retry = await run(repo);
        profile('retry-end');
        expect(retry.code, retry.stdout).toBe(0);
        expect(repo.prs()).toHaveLength(1);
        expect(readdirSync(evidenceDir)).toHaveLength(1);
        expect(repo.calls()).toHaveLength(2);
      } finally {
        profile('cleanup-start');
        repo.cleanup();
        profile('cleanup-end');
      }
      outcome = 'passed';
    } finally {
      profile('test-outcome', { outcome });
      profile('test-end');
    }
  }, process.platform === 'win32' ? 120_000 : 60_000);
});

// 品質コマンドから、祖先をたどって外部操作の監視役を探し、SIGINT を送る。送った先を interrupted.json に書く。
// POSIX の ps には監視役の process.title が、Windows の CommandLine には監視役のスクリプトのパスが出る
const PS_LIST = 'Get-CimInstance Win32_Process | ForEach-Object { "{0}`t{1}`t{2}" -f $_.ProcessId, $_.ParentProcessId, $_.CommandLine }';
const SEND_SIGINT_TO_SUPERVISOR = `const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const win = process.platform === 'win32';
const listing = win
  ? execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ${JSON.stringify(PS_LIST)}], { encoding: 'utf8', maxBuffer: 16 << 20, windowsHide: true })
  : execFileSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8', maxBuffer: 16 << 20 });
const table = new Map();
for (const line of listing.split(/\\r?\\n/)) {
  const m = win ? line.match(/^(\\d+)\\t(\\d+)\\t(.*)$/) : line.match(/^\\s*(\\d+)\\s+(\\d+)\\s(.*)$/);
  if (m) table.set(Number(m[1]), { ppid: Number(m[2]), command: m[3] });
}
let pid = process.ppid;
let found;
for (let i = 0; i < 10 && table.has(pid); i++) {
  const entry = table.get(pid);
  if (/[\\\\/]supervisor\\.cjs|^loomake: command supervisor/.test(entry.command)) { found = { pid, command: entry.command, self: process.pid }; break; }
  pid = entry.ppid;
}
if (found) {
  fs.writeFileSync('interrupted.json', JSON.stringify(found));
  process.kill(found.pid, 'SIGINT');
  setInterval(() => {}, 100);
} else {
  fs.writeFileSync('interrupted.json', JSON.stringify({ error: '祖先に監視役が見つかりません', ppid: process.ppid }));
  process.exit(1);
}
`;

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
      const context = diagnosticContext(repo, { results: result.results }, cli);
      expectStoppedSoon(expectStalled(cli, (args) => args[0] === 'validate', context), endedAt, OPERATION_MS, context);
      expect(result.ok).toBe(false);
      expect(result.results.find((r) => r.check === 'openspec validate')).toMatchObject({ status: 'fail', detail: expect.stringContaining('実行時間の上限') });
    } finally { restoreEnv(); repo.cleanup(); }
  });
  it('[REQ-183][REQ-250] 品質コマンドの中断後に次のコマンドを実行しない', () => {
    const repo = makeRepo();
    let failure: unknown;
    try {
      // shell の親ではなく監視役へ送る。POSIX の exec は cmd.exe にないので、祖先をたどって監視役を見つけ、送った先を記録する。
      // Windows で別のプロセスから送る SIGINT は監視役の強制終了になり、結果を書かずに終わった監視役の扱い（REQ-250）を通る
      repo.write('send-sigint.cjs', SEND_SIGINT_TO_SUPERVISOR);
      repo.write('loomake.config.json', JSON.stringify({ openspecValidate: false, commands: { lint: 'node send-sigint.cjs', test: `node -e "require('node:fs').writeFileSync('after','x')"` } }));
      // 祖先の一覧を Windows の PowerShell で読むと数秒かかるので、期限は中断より十分長くする。期限で止まると「中断」を含まず、この試験は落ちる
      const result = withProcessBudget({ timeoutMs: 30_000 }, () => runVerify({ root: repo.root }));
      const sent = JSON.parse(readFileSync(join(repo.root, 'interrupted.json'), 'utf8')) as { pid?: number; command?: string; self?: number; error?: string };
      expect(sent).toMatchObject({ command: expect.stringMatching(/[\\/]supervisor\.cjs|^loomake: command supervisor/) });
      expect(result.results.find((r) => r.check === 'command: lint')).toMatchObject({ status: 'fail', detail: expect.stringContaining('中断') });
      expect(result.results.find((r) => r.check === 'command: test')).toMatchObject({ status: 'fail', detail: expect.stringContaining('中断') });
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
      expect(result.results.find((r) => r.check === 'command: test')).toMatchObject({ status: 'fail', detail: expect.stringContaining('実行時間の上限') });
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

describe('フックを動かす git の操作の期限', () => {
  it('[REQ-182] 1 操作の期限より遅い pre-commit・pre-push のフックがあっても、run の残り時間の中でコミット・push・PR の作成まで進む', async () => {
    // Windows では外部操作ごとに保持役へ保持を頼むので、通常の git も 500ms を超えることがある（run 40630863426）。
    // そこで Windows では 1 操作の期限を 2 秒、フックを 3 秒、run の予算を 40 秒にし、フックが 1 操作の期限より遅いことは保つ
    const win = process.platform === 'win32';
    const operationMs = win ? 2_000 : OPERATION_MS;
    const hookSeconds = win ? 3 : 1;
    const repo = makeRepo();
    try {
      for (const name of ['pre-commit', 'pre-push']) {
        const hook = join(repo.root, '.git', 'hooks', name);
        writeFileSync(hook, `#!/bin/sh\nsleep ${hookSeconds}\n`);
        chmodSync(hook, 0o755);
      }
      repo.plan([{ write: { 'impl.txt': '実装\n' } }, noChange]);
      const r = await withProcessBudget({ timeoutMs: win ? 40_000 : 20_000, maxOperationMs: operationMs }, () => run(repo));
      expect(r.code, r.stdout).toBe(0);
      expect(summary(repo)).toMatchObject({ status: 'completed', remainingTasks: [] });
      expect(repo.prs()).toHaveLength(1);
    } finally { repo.cleanup(); }
  }, 60_000);
});
