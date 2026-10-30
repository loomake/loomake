import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, openSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '@loomake/kit';
import { runRun } from '@loomake/runner';
import { loadRunConfig } from '../src/run/prepare.js';
import { startRecording } from '../src/run/recorder.js';
import { resultFaultReason } from '../src/run/decision-policy.js';
import type { RunContext } from '../src/run/types.js';
import { CHANGE, makeRepo, type Repo } from './helpers.js';

vi.setConfig({ testTimeout: 60_000 });
vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  return { ...fs, openSync: vi.fn(fs.openSync), writeFileSync: vi.fn(fs.writeFileSync) };
});
afterEach(() => vi.clearAllMocks());
const failure = { is_error: true, subtype: 'error_max_turns' };
const dir = (repo: Repo) => {
  const parent = join(repo.root, '.loomake/runs');
  return join(parent, readdirSync(parent).find((name) => name !== '.gitignore')!);
};
async function run(repo: Repo) {
  const out: string[] = [];
  const code = await runRun({ root: repo.root, changeId: CHANGE, env: repo.env, interactive: false, confirm: async () => false, stdout: (text) => out.push(text), fileExists: () => false });
  return { code, stdout: out.join('\n') };
}
function recorder(repo: Repo, output: string[]) {
  const context: RunContext = {
    root: repo.root, changeId: CHANGE, changeDir: join(repo.root, `openspec/changes/${CHANGE}`), env: repo.env,
    now: () => new Date('2026-01-01T00:00:00Z'), stdout: (text) => output.push(text), progress: () => {},
    options: { root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, stdout: (text) => output.push(text) },
    config: loadConfig(repo.root), runConfig: loadRunConfig(repo.root),
    branch: 'loomake/c1', startBranch: 'main', hasBranch: false,
    tasksPath: join(repo.root, `openspec/changes/${CHANGE}/tasks.md`), tasksRel: `openspec/changes/${CHANGE}/tasks.md`,
    engineTasks: [], gateTasks: [],
  };
  return startRecording(context);
}
async function failWrite(name: string, test: () => Promise<void>) {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  const opened = new Map<number, string>();
  vi.mocked(openSync).mockImplementation((path, flags, mode) => {
    const fd = actual.openSync(path, flags, mode); opened.set(fd, String(path)); return fd;
  });
  vi.mocked(writeFileSync).mockImplementation((path, data, options) => {
    const file = typeof path === 'number' ? opened.get(path) : String(path);
    if (file?.endsWith(name)) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
    return actual.writeFileSync(path, data, options);
  });
  try { await test(); }
  finally {
    vi.mocked(openSync).mockImplementation(actual.openSync);
    vi.mocked(writeFileSync).mockImplementation(actual.writeFileSync);
  }
}

describe('結果の異常で止める記録と保存失敗の段階', () => {
  it('[REQ-340][REQ-179] 多数の違反による別形式でも結果の異常と短い具体パスを先頭に残す', async () => {
    const repo = makeRepo();
    try {
      const changes = Object.fromEntries(Array.from({ length: 1200 }, (_, i) => [`openspec/changes/c1/n/${i}-${'a'.repeat(50)}.md`, 'changed\n']));
      repo.plan([{ write: changes, resultFields: failure }]);
      const result = await run(repo);
      expect(result.code).toBe(1);
      expect(existsSync(join(dir(repo), 'summary.json'))).toBe(false);
      const stop = JSON.parse(readFileSync(join(dir(repo), 'stop.json'), 'utf8'));
      expect(stop.reason).toMatch(/^エンジンが失敗の結果を返しました/);
      expect(stop.reason).toContain(join(dir(repo), '01-output.json'));
      expect(stop.reason).toContain('不正な直し方を見つけました');
      expect(stop.reason.length).toBeLessThanOrEqual(2048);
      expect(repo.git('diff', '--cached', '--name-only')).toBe('');
      expect(repo.calls()).toHaveLength(1);
    } finally { repo.cleanup(); }
  });

  it('[REQ-340][REQ-179] 全OS共通の長いパス文字列は別形式の2048UTF16本文に収める', () => {
    const repo = makeRepo();
    try {
      const output: string[] = []; const rec = recorder(repo, output);
      const longPath = '/runs/' + 'a'.repeat(2100) + '/01-output.json';
      const reason = resultFaultReason({ kind: 'failure', subtype: 'error_max_turns' }, longPath) + '。不正な直し方：' + 'a'.repeat(70000);
      expect(rec.finish('stopped', reason, [])).toBe(1);
      const stop = JSON.parse(readFileSync(join(rec.runDir, 'stop.json'), 'utf8'));
      expect(stop.reason.length).toBeLessThanOrEqual(2048);
      expect(stop.reason).toMatch(/^エンジンが失敗の結果を返しました/);
      expect(stop.reason).toContain('出力の記録：/runs/');
      expect(stop.reason).not.toContain(longPath);
      expect(existsSync(join(rec.runDir, 'summary.json'))).toBe(false);
    } finally { repo.cleanup(); }
  });

  it('[REQ-340][REQ-179] 分類後のsummary保存失敗でも先頭の理由と未保存の確認先を表示する', async () => {
    const repo = makeRepo();
    try {
      repo.plan([{ write: { 'impl.txt': 'unfinished' }, resultFields: failure }]);
      await failWrite('summary.json', async () => {
        const result = await run(repo);
        expect(result.code).toBe(1);
        expect(result.stdout).toContain('loomake run を止めました：エンジンが失敗の結果を返しました');
        expect(result.stdout).toContain(join(dir(repo), '01-output.json'));
        expect(result.stdout).toContain('記録を保存できません');
        expect(result.stdout).toContain('保存先を確認してください');
        expect(result.stdout).not.toContain('記録：.loomake');
        expect(existsSync(join(dir(repo), 'summary.json'))).toBe(false);
        expect(readFileSync(join(repo.root, 'impl.txt'), 'utf8')).toBe('unfinished');
        expect(repo.git('diff', '--cached', '--name-only')).toBe('');
      });
    } finally { repo.cleanup(); }
  });

  it('[REQ-340][REQ-179] 分類後の別形式stop保存失敗も短い結果の異常と未保存を表示する', async () => {
    const repo = makeRepo();
    try {
      const output: string[] = []; const rec = recorder(repo, output);
      const reason = resultFaultReason({ kind: 'shape' }, join(rec.runDir, '01-output.json')) + '。不正な直し方：' + 'a'.repeat(70000);
      await failWrite('stop.json', async () => {
        expect(rec.finish('stopped', reason, [])).toBe(1);
      });
      const shown = output.join('\n');
      expect(shown).toContain('loomake run を止めました：エンジンの結果を読めません');
      expect(shown).toContain('記録を保存できません');
      expect(shown).toContain('保存先を確認してください');
      expect(shown.length).toBeLessThan(4000);
      expect(existsSync(join(rec.runDir, 'summary.json'))).toBe(false);
      expect(existsSync(join(rec.runDir, 'stop.json'))).toBe(false);
    } finally { repo.cleanup(); }
  });

  it('[REQ-340][REQ-179] 分類前のoutput保存失敗は既存I/O停止を保ちE3理由を補わない', async () => {
    const repo = makeRepo();
    try {
      const original = repo.git('rev-parse', 'HEAD');
      repo.plan([{ write: { 'impl.txt': 'unfinished' }, resultFields: failure }]);
      await failWrite('-output.json', async () => {
        const result = await run(repo);
        expect(result.code).toBe(1);
        expect(result.stdout).toContain('記録を保存できません');
        expect(result.stdout).not.toContain('エンジンが失敗の結果を返しました');
        expect(existsSync(join(dir(repo), 'summary.json'))).toBe(false);
        expect(repo.git('rev-parse', 'HEAD')).toBe(original);
        expect(repo.git('diff', '--cached', '--name-only')).toBe('');
        expect(readFileSync(join(repo.root, 'impl.txt'), 'utf8')).toBe('unfinished');
        expect(repo.calls()).toHaveLength(1);
      });
    } finally { repo.cleanup(); }
  });
});
