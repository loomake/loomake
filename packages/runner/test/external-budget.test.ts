import { appendFileSync, chmodSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { RuntimeFailure, UsageError, runVerify } from '@loomake/kit';
import { main } from '../../cli/src/main.js';
import { withProcessBudget } from '../../kit/src/runtime/process.js';
import { runRecord } from '@loomake/trace';
import { runRun } from '@loomake/runner';
import { makeRepo, CHANGE, type Repo } from './helpers.js';

// git やコマンドのプロセスを何度も起動するので、マシンの負荷が高いと既定の 5 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
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
function diagnosticContext(repo: Repo, details: object): string {
  const file = diagnosticFile(repo);
  const value = JSON.stringify({ ...details, stalled: existsSync(join(repo.base, 'stalled')), events: existsSync(file) ? readFileSync(file, 'utf8') : '' });
  const context = Buffer.from(value).subarray(0, DIAGNOSTIC_BYTES).toString('utf8');
  const output = process.env.LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_FILE;
  if (output) writeFileSync(output, context, { flag: 'wx' });
  return context;
}
function shim(repo: Repo, command: string, when: string, finishFirst = false, stallMs = 3000) {
  const bin = join(repo.base, 'bin');
  const original = command === 'git' ? realGit : join(bin, `${command}-original`);
  if (command !== 'git') { writeFileSync(original, readFileSync(join(bin, command))); chmodSync(original, 0o755); }
  const script = `#!/usr/bin/env node
const fs=require('node:fs');const cp=require('node:child_process');const args=process.argv.slice(2);
function event(name,details={}){const file=${JSON.stringify(diagnosticFile(repo))};const used=fs.existsSync(file)?fs.statSync(file).size:0;if(used>=${DIAGNOSTIC_BYTES})return;fs.appendFileSync(file,Buffer.from(JSON.stringify({event:name,at:Date.now(),pid:process.pid,command:${JSON.stringify(command)},args:args.slice(0,12).map(arg=>arg.slice(0,160)),...details})+'\\n').subarray(0,${DIAGNOSTIC_BYTES}-used));}
event('shim-start');
process.on('exit',code=>event('shim-end',{code}));
function forward(){event('forward-start');const result=cp.spawnSync(${JSON.stringify(original)},args,{stdio:'inherit'});event('forward-end',{status:result.status,signal:result.signal,error:result.error?.code});return result.status??1;}
if(${when}) {${finishFirst ? 'forward();' : ''} event('stall-start');fs.writeFileSync(${JSON.stringify(join(repo.base, 'stalled'))},'yes');process.on('SIGTERM',()=>{});setTimeout(()=>process.exit(0),${stallMs});} else process.exit(forward());
`;
  writeFileSync(join(bin, command), script); chmodSync(join(bin, command), 0o755);
}
async function run(repo: Repo) {
  const out: string[] = [];
  const code = await runRun({ root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, stdout: (text) => out.push(text), env: repo.env, fileExists: () => false });
  return { code, stdout: out.join('\n') };
}
const budget = <T>(action: () => T) => withProcessBudget({ timeoutMs: 20_000, maxOperationMs: 500 }, action);
const summary = (repo: Repo) => { const dir = join(repo.root, '.loomake/runs'); const run = readdirSync(dir).filter((s) => s !== '.gitignore').sort().at(-1)!; return JSON.parse(readFileSync(join(dir, run, 'summary.json'), 'utf8')); };

describe('runから外部操作までの期限', () => {
  it('[REQ-182] ロック取得のGitが止まったら変更と記録を作らない', async () => {
    const started = Date.now();
    const repo = makeRepo();
    diagnosticEvent(repo, 'fixture-ready', { elapsedMs: Date.now() - started });
    try {
      const before = repo.git('rev-parse', 'HEAD'); shim(repo, 'git', "args.includes('--absolute-git-dir')");
      // 開始前の制限エラーは実行時の失敗（close-cli-gaps で使い方の誤りから変更）
      diagnosticEvent(repo, 'run-start');
      const error = await budget(() => run(repo)).catch((e: unknown) => e);
      diagnosticEvent(repo, 'run-end', { elapsedMs: Date.now() - started });
      const context = diagnosticContext(repo, { error: String(error), elapsedMs: Date.now() - started });
      expect(error, context).toBeInstanceOf(RuntimeFailure);
      expect(error, context).not.toBeInstanceOf(UsageError);
      expect(existsSync(join(repo.base, 'stalled')), context).toBe(true);
      expect(repo.git('rev-parse', 'HEAD')).toBe(before);
      expect(repo.calls()).toEqual([]);
      expect(existsSync(join(repo.root, '.loomake/runs'))).toBe(false);
    } finally { repo.cleanup(); }
  });
  it('[REQ-182] 準備で使った時間を含めてエンジンの期限を制限する', async () => {
    const repo = makeRepo();
    try {
      repo.plan([{ sleepMs: 3000, write: { 'late.txt': '遅い変更' } }]);
      const start = Date.now();
      const result = await withProcessBudget({ timeoutMs: 1200 }, () => run(repo));
      expect(result.code).toBe(1);
      expect(result.stdout).toContain('実行時間の上限');
      expect(Date.now() - start).toBeLessThan(2500);
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
  it('[REQ-116][REQ-182] 事前の認証確認が期限切れなら実装も記録も始めない', async () => {
    const repo = makeRepo();
    try {
      const before = repo.git('rev-parse', 'HEAD');
      shim(repo, 'gh', "args[0]==='auth'");
      const error = await budget(() => run(repo)).catch((value: unknown) => value);
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
  it.each(['push', 'auth', 'list', 'create'] as const)('[REQ-182] %sの期限後に先へ進まず、再実行で重複させない', async (stage) => {
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
      shim(repo, command, condition, stage === 'create', untilDeadline ? 30_000 : 3000);
      diagnosticEvent(repo, 'run-start', { stage });
      // untilDeadline の 2 つは、止まる手前の通常の git・gh が負荷で遅れても 1 操作の期限に当たらないよう余裕を持たせ、
      // 止まったのが共有の期限であることは所要時間の下限で確かめる。
      // 共有の期限は、負荷の高い CI でも証拠の記録（verify を含む）が終わって push・create の停止に届く長さにする。
      // 短いと、証拠の記録の中で期限に当たって同じ「実行時間の上限」で止まり、確かめたい停止に届かない
      const SHARED_DEADLINE_MS = 12_000;
      const runStarted = Date.now();
      const result = await (untilDeadline ? withProcessBudget({ timeoutMs: SHARED_DEADLINE_MS, maxOperationMs: 5_000 }, () => run(repo)) : budget(() => run(repo)));
      const runElapsed = Date.now() - runStarted;
      diagnosticEvent(repo, 'run-end', { stage, code: result.code, elapsedMs: Date.now() - started });
      const context = diagnosticContext(repo, { stage, code: result.code, elapsedMs: Date.now() - started, stdout: result.stdout });
      expect(result.code, context).toBe(1);
      if (untilDeadline) expect(runElapsed, context).toBeGreaterThanOrEqual(SHARED_DEADLINE_MS - 500);
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
      if (command === 'git') { writeFileSync(join(repo.base, 'bin/git'), `#!/bin/sh\nexec ${realGit} "$@"\n`); }
      else writeFileSync(join(repo.base, 'bin/gh'), readFileSync(join(repo.base, 'bin/gh-original')));
      const retry = await run(repo);
      expect(retry.code, retry.stdout).toBe(0);
      expect(repo.prs()).toHaveLength(1);
      expect(readdirSync(evidenceDir)).toHaveLength(1);
      expect(repo.calls()).toHaveLength(2);
    } finally { repo.cleanup(); }
  }, 45_000);
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
    const repo = makeRepo(); const oldPath = process.env.PATH;
    try {
      shim(repo, 'git', "args[0]==='status'"); process.env.PATH = repo.env.PATH;
      expect(() => budget(() => runRecord({ root: repo.root, changeId: CHANGE, stdout: () => {} }))).toThrow('実行時間の上限');
      expect(existsSync(join(repo.root, '.loomake/evidence'))).toBe(false);
    } finally { process.env.PATH = oldPath; repo.cleanup(); }
  });
  it('[REQ-183] OpenSpec検証の時間切れをCLI不存在と区別する', () => {
    const repo = makeRepo(); const oldPath = process.env.PATH;
    try {
      repo.write('loomake.config.json', JSON.stringify({ openspecValidate: 'auto', commands: {} }));
      const executable = join(repo.base, 'bin/openspec'); writeFileSync(executable, '#!/usr/bin/env node\nsetTimeout(()=>{},3000)'); chmodSync(executable, 0o755); process.env.PATH = repo.env.PATH;
      const result = budget(() => runVerify({ root: repo.root, changeId: CHANGE, gate: 'spec-only' }));
      expect(result.ok).toBe(false);
      expect(result.results.find((r) => r.check === 'openspec validate')).toMatchObject({ status: 'fail', detail: expect.stringContaining('実行時間の上限') });
    } finally { process.env.PATH = oldPath; repo.cleanup(); }
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
      throw error;
    } finally {
      // 後片付けの失敗で、先の検査の失敗を隠さない。残ったプロセスがあれば一緒に示す
      try { repo.cleanup(); }
      catch (error) { throw new Error(`後片付けに失敗しました：${String(error)}\n先の失敗：${String(failure)}\n残ったプロセス：${leftovers('send-sigint')}`); }
    }
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
    const repo = makeRepo({ run: { timeoutMinutes: 0.02 } });
    const saved = { ...process.env };
    try {
      shim(repo, 'git', "args.includes('--absolute-git-dir')");
      Object.assign(process.env, repo.env);
      const out: string[] = [];
      const err: string[] = [];
      const code = await main(['run', '--change', CHANGE], { cwd: repo.root, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
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
