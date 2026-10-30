import { describe, it, expect, vi } from 'vitest';
import { chmodSync, copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunSummary } from '../src/run/types.js';
import { runRun } from '@loomake/runner';
import { CHANGE, makeRepo, noChange, signalSupervisorScript, type Repo } from './helpers.js';

vi.setConfig({ testTimeout: 60_000 });

/**
 * 品質コマンドは同期的に動くので、そのあいだに届いた信号の処理は、イベントループに戻るまで実行されない。
 * when に一致する進捗が出た時点で setImmediate で中断を予約し、この遅れをまねる
 */
async function abortDuring(when: (text: string, count: number) => boolean, lookup = false) {
  const repo = makeRepo();
  try {
    repo.plan([{ write: { 'impl.txt': '実装\n' } }, noChange]);
    const controller = new AbortController();
    let count = 0;
    // lookup のときは、偽の gh が PR を検索した記録を見て中断を予約する。検索は同期的に動くので、記録を見られるのは検索のあと
    const watcher = lookup ? setInterval(() => { if (existsSync(repo.env.FAKE_GH_LOOKUP_LOG!)) controller.abort(); }, 1) : undefined;
    const out: string[] = [];
    const code = await runRun({
      root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, env: repo.env, fileExists: () => false,
      stdout: (t) => out.push(t),
      progress: (t) => { if (t.startsWith('… test') && when(t, ++count)) setImmediate(() => controller.abort()); },
      signal: controller.signal,
    });
    clearInterval(watcher);
    const runs = join(repo.root, '.loomake/runs');
    const [run] = readdirSync(runs).filter((n) => n !== '.gitignore');
    const summary = JSON.parse(readFileSync(join(runs, run, 'summary.json'), 'utf8'));
    const pushed = repo.git('ls-remote', '--heads', 'origin').trim();
    return { code, stdout: out.join('\n'), summary, prs: repo.prs(), pushed };
  } finally {
    repo.cleanup();
  }
}

describe('同期の処理のあいだに届いた中断', () => {
  it('[REQ-208] 完了ゲートの品質コマンドのあいだに届いた中断で、証拠の記録・push・PR の作成に進まない', async () => {
    const r = await abortDuring((_t, count) => count === 1);
    expect(r.code).toBe(1);
    expect(r.summary.status).toBe('interrupted');
    expect(r.prs).toHaveLength(0);
    expect(r.pushed).toBe('');
  });

  it('[REQ-208] 証拠の記録の品質コマンドのあいだに届いた中断で、push と PR の作成に進まない', async () => {
    const r = await abortDuring((_t, count) => count === 2);
    expect(r.code).toBe(1);
    expect(r.summary.status).toBe('interrupted');
    expect(r.prs).toHaveLength(0);
    expect(r.pushed).toBe('');
  });

  it('[REQ-208] 既存の PR の検索のあいだに届いた中断で、PR を作らない', async () => {
    const r = await abortDuring(() => false, true);
    expect(r.code).toBe(1);
    expect(r.summary.status).toBe('interrupted');
    expect(r.prs).toHaveLength(0);
  });
});

const SINGLE_TASK = ['## 1. 実装', '- [ ] 1.1 一つ目のタスク（REQ-012）', '', '## 3. 確認', '- [ ] 3.1 `pnpm -s verify --change c1 --done` を通す', ''].join('\n');

function signalScript(repo: Repo, signal: NodeJS.Signals) {
  const file = join(repo.base, 'send-signal.cjs');
  writeFileSync(file, signalSupervisorScript(signal));
  return file;
}

function signalHook(repo: Repo, name: string, signal: NodeJS.Signals) {
  const hook = join(repo.root, '.git/hooks', name);
  writeFileSync(hook, `#!/bin/sh\nnode ${JSON.stringify(signalScript(repo, signal))}\n`);
  chmodSync(hook, 0o755);
}

function signalGh(repo: Repo, operation: string, signal: NodeJS.Signals) {
  const file = join(repo.base, 'bin/gh');
  const original = join(repo.base, 'bin/gh-original');
  copyFileSync(file, original);
  writeFileSync(file, `#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
if (args[0] === 'pr' && args[1] === ${JSON.stringify(operation)}) {
  spawnSync(process.execPath, [${JSON.stringify(signalScript(repo, signal))}], { stdio: 'inherit' });
  process.exit(1);
}
const result = spawnSync(process.execPath, [${JSON.stringify(original)}, ...args], { stdio: 'inherit' });
process.exit(result.status ?? 1);
`);
  chmodSync(file, 0o755);
}

async function runWithSupervisorSignal(setup: (repo: Repo) => void) {
  const repo = makeRepo({ tasks: SINGLE_TASK });
  try {
    repo.plan([{ write: { 'impl.txt': '実装\n' } }]);
    setup(repo);
    const code = await runRun({ root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, env: repo.env, fileExists: () => false, stdout: () => {} });
    const directory = join(repo.root, '.loomake/runs');
    const [run] = readdirSync(directory).filter((name) => name !== '.gitignore');
    const runDir = join(directory, run);
    const summary = JSON.parse(readFileSync(join(runDir, 'summary.json'), 'utf8')) as RunSummary;
    const verifications = readdirSync(runDir).filter((name) => /^\d+-verify/.test(name)).map((name) => JSON.parse(readFileSync(join(runDir, name), 'utf8')) as { results: { check: string; detail?: string }[] });
    const sent = JSON.parse(readFileSync(join(repo.base, 'interrupted.json'), 'utf8')) as { command?: string };
    expect(sent.command).toMatch(/[\\/]supervisor\.cjs|^loomake: command supervisor/);
    return { code, summary, verifications, calls: repo.calls(), prs: repo.prs(), pushed: repo.git('ls-remote', '--heads', 'origin'), head: repo.git('log', '-1', '--format=%s'), implementation: existsSync(join(repo.root, 'impl.txt')) };
  } finally { repo.cleanup(); }
}

const posixIt = it.runIf(process.platform !== 'win32');
describe('外部操作の監視役が受けた中断', () => {
  posixIt.each(['SIGINT', 'SIGTERM'] as const)('[REQ-337] タスクのコミットのgitのあいだに監視役が%sを受けたら、interruptedにする', async (signal) => {
    const result = await runWithSupervisorSignal((repo) => signalHook(repo, 'pre-commit', signal));
    expect(result.code).toBe(1);
    expect(result.summary.status).toBe('interrupted');
    expect(result.summary.doneTasks).toEqual([]);
    expect(result.summary.remainingTasks[0]).toMatch(/^1\.1 /);
    expect(result.calls).toHaveLength(1);
    expect(result.implementation).toBe(true);
    expect(result.prs).toHaveLength(0);
    expect(result.pushed).toBe('');
  });

  posixIt('[REQ-337] 証拠のpushのあいだの中断で、証拠のコミットを保ちinterruptedにする', async () => {
    const result = await runWithSupervisorSignal((repo) => signalHook(repo, 'pre-push', 'SIGINT'));
    expect(result.code).toBe(1);
    expect(result.summary.status).toBe('interrupted');
    expect(result.summary.reason).toContain('証拠のコミットを保っています');
    expect(result.head).toMatch(/^evidence\(c1\):/);
    expect(result.pushed).toBe('');
    expect(result.prs).toHaveLength(0);
  });

  posixIt.each([['list', 'SIGINT'], ['create', 'SIGTERM']] as const)('[REQ-337] PRの%sのあいだに監視役が%sを受けたら、証拠とpushを保ちinterruptedにする', async (operation, signal) => {
    const result = await runWithSupervisorSignal((repo) => signalGh(repo, operation, signal));
    expect(result.code).toBe(1);
    expect(result.summary.status).toBe('interrupted');
    expect(result.summary.reason).toContain('証拠のコミットを保っています');
    expect(result.head).toMatch(/^evidence\(c1\):/);
    expect(result.pushed).toContain('refs/heads/loomake/c1');
    expect(result.prs).toHaveLength(0);
  });

  posixIt('[REQ-337] 監視役が結果を書かずに終わったときは、利用者の中断と区別してstoppedのままにする', async () => {
    const result = await runWithSupervisorSignal((repo) => signalHook(repo, 'pre-commit', 'SIGKILL'));
    expect(result.code).toBe(1);
    expect(result.summary.status).toBe('stopped');
    expect(result.summary.reason).toContain('監視役が結果を書かずに終了しました');
    expect(result.calls).toHaveLength(1);
    expect(result.prs).toHaveLength(0);
    expect(result.pushed).toBe('');
  });

  posixIt.each([true, false])('[REQ-337] 品質コマンドの監視役の異常終了後は理由を保ちstoppedにする（後続の品質コマンド: %s）', async (followingCommand) => {
    const result = await runWithSupervisorSignal((repo) => {
      const command = `node ${JSON.stringify(signalScript(repo, 'SIGKILL'))}`;
      repo.write('loomake.config.json', JSON.stringify({ openspecValidate: false, commands: followingCommand ? { lint: command, test: 'node write-report.mjs' } : { test: command } }));
      repo.git('add', 'loomake.config.json');
      repo.git('commit', '-q', '-m', '品質コマンドの中断を準備');
    });
    expect(result.code).toBe(1);
    expect(result.summary.status).toBe('stopped');
    expect(result.summary.reason).toContain('監視役が結果を書かずに終了しました');
    expect(result.calls).toHaveLength(1);
    expect(result.prs).toHaveLength(0);
    expect(result.pushed).toBe('');
    if (followingCommand) expect(result.verifications[0].results.find((item) => item.check === 'command: test')?.detail).toContain('中断されたので止めました（監視役が結果を書かずに');
  });
});
