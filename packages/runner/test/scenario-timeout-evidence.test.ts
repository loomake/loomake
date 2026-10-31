import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runRun } from '@loomake/runner';
import { TIMED_OUT, verifyExitCode, withProcessBudget } from '@loomake/kit';
import { CHANGE, makeRepo, type Repo } from './helpers.js';

const monitor = vi.hoisted(() => ({ ready: '', git: [] as { args: string[]; afterReady: boolean }[] }));
vi.mock('node:child_process', async (original) => {
  const cp = await original<typeof import('node:child_process')>();
  const fs = await import('node:fs');
  return { ...cp, spawnSync: vi.fn(cp.spawnSync).mockImplementation((command, args, options) => {
    if (command === process.execPath && args?.[0]?.endsWith('supervisor.cjs')) {
      const [target, targetArgs] = JSON.parse(args[1]) as [string, string[]];
      if (target === 'git') monitor.git.push({ args: targetArgs, afterReady: Boolean(monitor.ready && fs.existsSync(monitor.ready)) });
    }
    return cp.spawnSync(command, args, options);
  }) };
});

const task = '- [ ] 3.1 quality gate <!-- loomake:gate=done -->\n';
const tasksPath = (repo: Repo) => join(repo.root, `openspec/changes/${CHANGE}/tasks.md`);
const checkpointPath = (repo: Repo) => join(repo.base, 'quality-ready.json');
const counterPath = (repo: Repo) => join(repo.base, 'quality-count');
const latePath = (repo: Repo) => join(repo.base, 'late-quality-write');
type Checkpoint = { pid: number; invocation: number; tasks: string };

function running(pid: number): boolean {
  try { process.kill(pid, 0); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; }
  if (process.platform === 'linux') {
    try { return !/\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }
  return true;
}

function cleanupQuality(repo: Repo): void {
  if (!existsSync(checkpointPath(repo))) return;
  const { pid } = JSON.parse(readFileSync(checkpointPath(repo), 'utf8')) as Checkpoint;
  if (!Number.isSafeInteger(pid) || pid <= 0 || !running(pid)) return;
  try { process.kill(pid, 'SIGKILL'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
}

function prepare(repo: Repo, stopAt: number): string {
  repo.write('impl.txt', 'preserved implementation\n');
  repo.write('quality.cjs', `const fs = require('node:fs');
const cp = require('node:child_process');
const countFile = ${JSON.stringify(counterPath(repo))};
const count = (fs.existsSync(countFile) ? Number(fs.readFileSync(countFile, 'utf8')) : 0) + 1;
fs.writeFileSync(countFile, String(count));
if (count === ${stopAt}) {
  fs.writeFileSync(${JSON.stringify(checkpointPath(repo))}, JSON.stringify({ pid: process.pid, invocation: count, tasks: fs.readFileSync(${JSON.stringify(tasksPath(repo))}, 'utf8') }));
  setTimeout(() => fs.writeFileSync(${JSON.stringify(latePath(repo))}, 'late'), 30000);
  setInterval(() => {}, 1000);
} else {
  process.exitCode = cp.spawnSync(process.execPath, ['write-report.mjs'], { stdio: 'inherit' }).status ?? 1;
}
`);
  repo.write('loomake.config.json', JSON.stringify({ openspecValidate: false, commands: { test: 'node quality.cjs' } }));
  repo.git('add', '-A');
  repo.git('commit', '-qm', 'quality timeout fixture');
  monitor.ready = checkpointPath(repo);
  monitor.git = [];
  return repo.git('rev-parse', 'HEAD');
}

async function run(repo: Repo, timeoutMs = 6000) {
  const output: string[] = [];
  const code = await withProcessBudget({ timeoutMs }, () => runRun({
    root: repo.root, changeId: CHANGE, env: repo.env, interactive: false,
    confirm: async () => false, stdout: (text) => output.push(text), fileExists: () => false,
  }));
  return { code, output: output.join('\n') };
}

function records(repo: Repo) {
  const base = join(repo.root, '.loomake/runs');
  const directories = readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  expect(directories).toHaveLength(1);
  const directory = join(base, directories[0].name);
  return {
    summary: JSON.parse(readFileSync(join(directory, 'summary.json'), 'utf8')),
    firstVerify: JSON.parse(readFileSync(join(directory, '00-verify.json'), 'utf8')),
  };
}

function stoppedQuality(repo: Repo, invocation: number) {
  expect(existsSync(checkpointPath(repo))).toBe(true);
  const checkpoint = JSON.parse(readFileSync(checkpointPath(repo), 'utf8')) as Checkpoint;
  expect(checkpoint.invocation).toBe(invocation);
  expect(Number(readFileSync(counterPath(repo), 'utf8'))).toBe(invocation);
  expect(Number.isSafeInteger(checkpoint.pid) && checkpoint.pid > 0).toBe(true);
  expect(running(checkpoint.pid)).toBe(false);
  expect(existsSync(latePath(repo))).toBe(false);
  expect(checkpoint.tasks).toBe(task.replace('[ ]', '[x]'));
  expect(monitor.git.some((entry) => !entry.afterReady && entry.args[0] === 'rev-parse')).toBe(true);
  expect(monitor.git.filter((entry) => entry.afterReady)).toEqual([]);
}

function unpublished(repo: Repo) {
  expect(repo.calls()).toEqual([]);
  expect(repo.prs()).toEqual([]);
  expect(existsSync(repo.env.FAKE_GH_LOOKUP_LOG!)).toBe(false);
  expect(existsSync(join(repo.root, '.loomake/evidence'))).toBe(false);
  expect(repo.git('ls-remote', 'origin')).toBe('');
  expect(readFileSync(join(repo.root, 'impl.txt'), 'utf8')).toBe('preserved implementation\n');
}

describe('品質コマンドの時間切れの直接検証', () => {
  it('[REQ-182] 共有期限後にGitを起動せず、一時的なゲート完了印を戻す', async () => {
    const repo = makeRepo({ tasks: task });
    try {
      const head = prepare(repo, 1);
      const result = await run(repo);
      expect(result.code, result.output).toBe(1);
      stoppedQuality(repo, 1);
      const { summary, firstVerify } = records(repo);
      expect(verifyExitCode(firstVerify)).toBe(1);
      // 時間の上限で止めた品質コマンドは不足と実行エラー（verify-v2-wiring の仮定 A-03）
      expect(firstVerify.checks).toContainEqual(expect.objectContaining({ id: 'command: test', result: 'INSUFFICIENT_EVIDENCE', reason: TIMED_OUT }));
      expect(summary).toMatchObject({ status: 'stopped', doneTasks: [], lastVerify: { ok: false } });
      expect(summary.reason).toContain('実行時間の上限');
      expect(readFileSync(tasksPath(repo), 'utf8')).toBe(task);
      expect(repo.git('rev-parse', 'HEAD')).toBe(head);
      unpublished(repo);
    } finally {
      cleanupQuality(repo);
      repo.cleanup();
      monitor.ready = '';
    }
  }, 20_000);

  // 2 回目の品質コマンドに届くまでに、1 回目の検証・タスクのコミット・2 回目の検証の準備の外部操作がある。
  // Windows では外部操作ごとに保持役へ保持を頼むので遅く、6 秒では 2 回目を始める前に予算が尽きることがあった（run 40485476247、Issue #5）。
  // そこで Windows では予算を 20 秒にする。2 回目は自分では終わらないので、予算を延ばしても共有期限で止まることは変わらない
  const SECOND_RUN_BUDGET_MS = process.platform === 'win32' ? 20_000 : 6000;
  it('[REQ-140] 初回の検証成功を確認した後、2回目を停止して時間切れを記録する', async () => {
    const repo = makeRepo({ tasks: task });
    try {
      const head = prepare(repo, 2);
      const result = await run(repo, SECOND_RUN_BUDGET_MS);
      expect(result.code, result.output).toBe(1);
      stoppedQuality(repo, 2);
      const { summary, firstVerify } = records(repo);
      expect(verifyExitCode(firstVerify)).toBe(0);
      expect(firstVerify.checks).toContainEqual(expect.objectContaining({ id: 'command: test', result: 'PASS' }));
      expect(summary).toMatchObject({ status: 'stopped', lastVerify: { ok: false } });
      expect(summary.reason).toContain('実行時間の上限');
      expect(readFileSync(tasksPath(repo), 'utf8')).toBe(task.replace('[ ]', '[x]'));
      expect(repo.git('rev-parse', 'HEAD~1')).toBe(head);
      expect(repo.git('log', '-1', '--format=%s')).toBe('run(c1): 完了ゲートに合格');
      unpublished(repo);
    } finally {
      cleanupQuality(repo);
      repo.cleanup();
      monitor.ready = '';
    }
  }, process.platform === 'win32' ? 45_000 : 20_000);
});
