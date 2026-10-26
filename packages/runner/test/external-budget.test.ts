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
type ShimEvent = { event: string; at: number; command?: string; args?: string[]; status?: number | null; signal?: string | null; error?: string };
// 診断の記録は上限で切られるので、最後の行が壊れていたら読み飛ばす
function shimEvents(repo: Repo): ShimEvent[] {
  const file = diagnosticFile(repo);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').flatMap((line) => {
    try { return line ? [JSON.parse(line) as ShimEvent] : []; } catch { return []; }
  });
}
const describeEvent = (event: ShimEvent | undefined) => event ? `${event.event}: ${event.command ?? ''} ${(event.args ?? []).join(' ')}`.trim() : '（偽の CLI の記録がない）';
/**
 * 偽の CLI が、狙った操作（引数の先頭が operation）で止まったことを確かめ、その stall-start を返す。
 * 負荷が高いと、狙った操作に届く前の git・gh で期限に当たり、同じ「実行時間の上限」で止まる。
 * そのとき、どこで止まったかが分かるメッセージで落とす。
 */
function expectStalledAt(repo: Repo, operation: readonly string[], context: string): ShimEvent {
  const events = shimEvents(repo);
  const index = events.findIndex((event) => event.event === 'stall-start');
  // 試験自身の記録（run-start など）を除き、偽の CLI が最後に記録した操作を示す
  const last = describeEvent(events.filter((event) => event.command && event.event !== 'stall-start').at(-1));
  expect(existsSync(join(repo.base, 'stalled')), `偽の CLI が ${operation.join(' ')} で止まる前に run が終わりました（stalled の印がない）。最後の記録は ${last}\n${context}`).toBe(true);
  expect(index, `stall-start の記録がありません。最後の記録は ${last}\n${context}`).toBeGreaterThanOrEqual(0);
  const stall = events[index]!;
  expect(stall.args?.slice(0, operation.length), `${operation.join(' ')} ではなく、${describeEvent(stall)} で止まりました\n${context}`).toEqual([...operation]);
  const failed = events.slice(0, index).filter((event) => event.event === 'forward-end' && (event.error || event.signal));
  expect(failed, `止まる前の操作が失敗しました：${failed.map((event) => `${describeEvent(event)}（error=${event.error ?? ''}、signal=${event.signal ?? ''}）`).join('、')}\n${context}`).toEqual([]);
  return stall;
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
      // list・auth は 1 操作の期限で止める。止まる手前の git・gh（ロックの確認、verify、git status など）が
      // 負荷で遅れても期限に当たらない長さにし、偽の CLI はそれより十分長く止める
      const OPERATION_MS = 2_000;
      const STALL_MS = 6_000;
      // 1 操作の期限には監視役と偽の CLI の起動時間も入るので、stall-start からの時間は期限より短くなりうる
      const OPERATION_SLACK_MS = 1_000;
      shim(repo, command, condition, stage === 'create', untilDeadline ? 30_000 : STALL_MS);
      diagnosticEvent(repo, 'run-start', { stage });
      // untilDeadline の 2 つは、止まる手前の通常の git・gh が負荷で遅れても 1 操作の期限に当たらないよう余裕を持たせ、
      // 止まったのが共有の期限であることは所要時間の下限で確かめる。
      // 共有の期限は、負荷の高い CI でも証拠の記録（verify を含む）が終わって push・create の停止に届く長さにする。
      // 短いと、証拠の記録の中で期限に当たって同じ「実行時間の上限」で止まり、確かめたい停止に届かない
      const SHARED_DEADLINE_MS = 12_000;
      const runStarted = Date.now();
      const result = await withProcessBudget(untilDeadline ? { timeoutMs: SHARED_DEADLINE_MS, maxOperationMs: 5_000 } : { timeoutMs: 20_000, maxOperationMs: OPERATION_MS }, () => run(repo));
      const runEnded = Date.now();
      const runElapsed = runEnded - runStarted;
      diagnosticEvent(repo, 'run-end', { stage, code: result.code, elapsedMs: Date.now() - started });
      const context = diagnosticContext(repo, { stage, code: result.code, elapsedMs: Date.now() - started, stdout: result.stdout });
      // 期限の検査より先に、止まったのが確かめたい段階であることを、停止の印と偽の CLI の記録で確かめる
      const operation = { push: ['push'], auth: ['auth', 'status'], list: ['pr', 'list'], create: ['pr', 'create'] }[stage];
      const stall = expectStalledAt(repo, operation, context);
      expect(result.code, context).toBe(1);
      if (untilDeadline) expect(runElapsed, context).toBeGreaterThanOrEqual(SHARED_DEADLINE_MS - 500);
      else {
        // 共有の期限ではなく 1 操作の期限で止まったことを、停止してから run が終わるまでの時間で確かめる
        expect(runEnded - stall.at, context).toBeGreaterThanOrEqual(OPERATION_MS - OPERATION_SLACK_MS);
        expect(runEnded - stall.at, context).toBeLessThan(STALL_MS);
      }
      expect(result.stdout, context).toContain('実行時間の上限');
      expect(summary(repo).status, context).toBe('stopped');
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
