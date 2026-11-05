import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../../cli/src/main.js';
import { runRun } from '../src/run.js';
import { CHANGE, makeRepo as originalMakeRepo } from './helpers.js';

const fault = vi.hoisted(() => ({ enabled: false, value: undefined as unknown, finishFails: false }));
vi.mock('../src/run/prompt.js', async (original) => {
  const actual = await original<typeof import('../src/run/prompt.js')>();
  return { ...actual, buildPrompt: (...args: Parameters<typeof actual.buildPrompt>) => {
    if (fault.enabled) throw fault.value;
    return actual.buildPrompt(...args);
  } };
});
vi.mock('../src/run/recorder.js', async (original) => {
  const actual = await original<typeof import('../src/run/recorder.js')>();
  return { ...actual, startRecording: (...args: Parameters<typeof actual.startRecording>) => {
    const rec = actual.startRecording(...args);
    if (fault.finishFails) rec.finish = () => { throw new Error('記録の合成エラー ghp_' + 'r'.repeat(24)); };
    return rec;
  } };
});
afterEach(() => { fault.enabled = false; fault.finishFails = false; });

let preparedRepo: ReturnType<typeof originalMakeRepo> | undefined;
beforeEach(() => { preparedRepo = originalMakeRepo(); });
function makeRepo() {
  const repo = preparedRepo;
  if (!repo) throw new Error('試験用のリポジトリが準備されていません');
  preparedRepo = undefined;
  return repo;
}

const token = 'ghp_' + 'x'.repeat(24);
describe('run の未分類例外', () => {
  it('[REQ-096] dry-run の指示作成の例外でも元のブランチへ戻る', async () => {
    const repo = makeRepo();
    try {
      repo.git('branch', `loomake/${CHANGE}`);
      const error = new Error('合成の指示エラー');
      Object.assign(fault, { enabled: true, value: error });
      await expect(runRun({ root: repo.root, changeId: CHANGE, dryRun: true, interactive: false, env: repo.env, stdout: () => {}, confirm: async () => false })).rejects.toBe(error);
      expect(repo.git('branch', '--show-current')).toBe('main');
      expect(existsSync(join(repo.root, '.loomake/runs'))).toBe(false);
      expect(repo.calls()).toEqual([]);
      expect(existsSync(join(repo.root, '.git/loomake-run.lock'))).toBe(false);
    } finally { repo.cleanup(); }
  });

  it.each([true, false])('[REQ-137][REQ-192] Error型=%s の未分類例外を伏せて記録し終了コード3にする', async (isError) => {
    const repo = makeRepo();
    const saved = { ...process.env };
    try {
      repo.git('branch', `loomake/${CHANGE}`);
      Object.assign(process.env, repo.env);
      const message = `合成の想定外の失敗 ${token}`;
      Object.assign(fault, { enabled: true, value: isError ? new Error(message) : message });
      const out: string[] = [], err: string[] = [];
      const code = await main(['run', '--change', CHANGE], { cwd: repo.root, stdout: t => out.push(t), stderr: t => err.push(t) });
      expect(code).toBe(3);
      const runs = join(repo.root, '.loomake/runs');
      const summaryText = readFileSync(join(runs, readdirSync(runs, { withFileTypes: true }).find(entry => entry.isDirectory())!.name, 'summary.json'), 'utf8');
      const summary = JSON.parse(summaryText);
      expect(summary.status).toBe('stopped');
      expect(summary.reason).toContain('合成の想定外の失敗 ***');
      expect(summary.doneTasks).toEqual([]);
      expect(summary.remainingTasks).toHaveLength(3);
      expect(summary.remainingTasks[0]).toContain('1.1');
      expect([summaryText, ...out, ...err].join('\n')).not.toContain(token);
      expect(err.join('\n')).toContain('loomake run: ');
      expect(err.join('\n')).not.toContain('使い方:');
      expect(repo.git('branch', '--show-current')).toBe(`loomake/${CHANGE}`);
      expect(repo.calls()).toEqual([]);
      expect(existsSync(join(repo.root, '.git/loomake-run.lock'))).toBe(false);
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved); repo.cleanup();
    }
  });

  it('[REQ-137] 想定外例外の停止記録も失敗したら伏せた保存理由で終了コード3を保つ', async () => {
    const repo = makeRepo();
    const saved = { ...process.env };
    try {
      Object.assign(process.env, repo.env);
      Object.assign(fault, { enabled: true, value: new Error(`合成の想定外の失敗 ${token}`), finishFails: true });
      const err: string[] = [];
      expect(await main(['run', '--change', CHANGE], { cwd: repo.root, stdout: () => {}, stderr: t => err.push(t) })).toBe(3);
      expect(err.join('\n')).toContain('記録を保存できません');
      expect(err.join('\n')).toContain('記録の合成エラー ***');
      expect(err.join('\n')).not.toContain(token);
      expect(err.join('\n')).not.toContain('ghp_' + 'r'.repeat(24));
      expect(existsSync(join(repo.root, '.git/loomake-run.lock'))).toBe(false);
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved); repo.cleanup();
    }
  });
});
