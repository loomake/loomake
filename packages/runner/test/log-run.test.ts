import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, truncateSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { UsageError } from '@loomake/kit';
import { runRun } from '@loomake/runner';
import { makeRepo, CHANGE, type Repo } from './helpers.js';

// git やコマンドのプロセスを何度も起動するので、マシンの負荷が高いと既定の 5 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

vi.mock('node:fs', async (original) => { const fs = await original<typeof import('node:fs')>(); return { ...fs, openSync: vi.fn(fs.openSync), writeFileSync: vi.fn(fs.writeFileSync) }; });
afterEach(() => vi.clearAllMocks());
async function run(repo: Repo, dryRun = false) {
  const out: string[] = [];
  const code = await runRun({ root: repo.root, changeId: CHANGE, dryRun, interactive: false, confirm: async () => false, stdout: (text) => out.push(text), env: repo.env, fileExists: () => false });
  return { code, stdout: out.join('\n') };
}
const runDir = (repo: Repo) => join(repo.root, '.loomake/runs', readdirSync(join(repo.root, '.loomake/runs')).find((name) => name !== '.gitignore')!);
const oldHistory = (repo: Repo) => { const dir = join(repo.root, '.loomake/runs'); mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, '.gitignore'), '*\n'); writeFileSync(join(dir, 'old.log'), ''); truncateSync(join(dir, 'old.log'), 5000); };

describe('runの記録予算', () => {
  it('[REQ-177] 履歴不足はブランチ・タスク・エンジン・記録を変えず止める', async () => {
    const repo = makeRepo({ run: { maxHistoryBytes: 65536 + 4096 } });
    try {
      oldHistory(repo); repo.plan([{ output: 'LOOMAKE-QUESTION: stop' }]);
      const before = repo.git('rev-parse', 'HEAD');
      const tasks = readFileSync(join(repo.root, `openspec/changes/${CHANGE}/tasks.md`), 'utf8');
      const attempt = run(repo);
      await expect(attempt).rejects.toThrow(UsageError);
      await expect(attempt).rejects.toThrow('69632バイト');
      await expect(attempt).rejects.toThrow(join(repo.root, '.loomake/runs'));
      expect(repo.git('rev-parse', 'HEAD')).toBe(before);
      expect(readFileSync(join(repo.root, `openspec/changes/${CHANGE}/tasks.md`), 'utf8')).toBe(tasks);
      expect(repo.git('branch', '--show-current')).toBe('main');
      expect(repo.calls()).toEqual([]);
      expect(readdirSync(join(repo.root, '.loomake/runs'))).toEqual(['.gitignore', 'old.log']);
    } finally { repo.cleanup(); }
  });

  it('[REQ-177] 履歴不足でもdry-runは記録を作らず確認できる', async () => {
    const repo = makeRepo({ run: { maxHistoryBytes: 65536 + 4096 } });
    try {
      oldHistory(repo);
      expect((await run(repo, true)).code).toBe(0);
      expect(repo.calls()).toEqual([]);
      expect(readdirSync(join(repo.root, '.loomake/runs'))).toEqual(['.gitignore', 'old.log']);
    } finally { repo.cleanup(); }
  });

  it.each(['run', 'history'])('[REQ-178][REQ-179] %sの合計超過では完了済みコミットと途中の変更を保ってsummaryで止める', async (mode) => {
    const repo = makeRepo({ run: mode === 'run' ? { maxLogBytes: 65536 + 10000 } : { maxHistoryBytes: 65536 + 10000 } });
    try {
      if (mode === 'history') oldHistory(repo);
      repo.plan([{ write: { 'impl.txt': 'first' }, output: 'あ'.repeat(300) }, { write: { 'second.txt': 'unfinished' }, output: 'あ'.repeat(4000) }]);
      const result = await run(repo);
      expect(result.code, result.stdout).toBe(1);
      const summary = JSON.parse(readFileSync(join(runDir(repo), 'summary.json'), 'utf8'));
      expect(summary.reason).toContain(mode === 'run' ? '記録の上限' : '履歴の上限');
      expect(summary.doneTasks).toHaveLength(1);
      expect(summary.remainingTasks).toHaveLength(2);
      expect(repo.git('log', '-1', '--format=%s')).toContain('一つ目のタスク');
      expect(readFileSync(join(repo.root, 'second.txt'), 'utf8')).toBe('unfinished');
      expect(repo.prs()).toEqual([]);
      expect(existsSync(join(runDir(repo), '02-output.json'))).toBe(false);
    } finally { repo.cleanup(); }
  });

  it('[REQ-179] 巨大な停止理由は通常summaryを偽装せず別形式の停止情報に保存する', async () => {
    const repo = makeRepo();
    try {
      repo.plan([{ output: 'LOOMAKE-QUESTION: ' + 'あ'.repeat(30000) }]);
      const result = await run(repo);
      expect(result.code).toBe(1);
      const dir = runDir(repo);
      expect(existsSync(join(dir, 'summary.json'))).toBe(false);
      const stop = JSON.parse(readFileSync(join(dir, 'stop.json'), 'utf8'));
      expect(stop).toMatchObject({ schemaVersion: 1, change: CHANGE, operationStatus: 'stopped', doneTaskCount: 0, remainingTaskCount: 3 });
      expect(stop.recordingError).toContain('予約');
      expect(stop.reason).toContain('あ'.repeat(30));
      expect(stop.lastVerify).toBeNull();
      expect(Buffer.byteLength(readFileSync(join(dir, 'stop.json'), 'utf8'))).toBeLessThanOrEqual(65536);
      expect(Buffer.byteLength(result.stdout)).toBeLessThan(20000);
      expect(repo.prs()).toEqual([]);
    } finally { repo.cleanup(); }
  });

  it('[REQ-179] ディスクの保存失敗は明示し、保存したと表示せず変更を保つ', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    const repo = makeRepo(); const opened = new Map<number, string>();
    try {
      repo.plan([{ write: { 'impl.txt': 'unfinished' } }]);
      vi.mocked(openSync).mockImplementation((path, flags, mode) => { const fd = actual.openSync(path, flags, mode); opened.set(fd, String(path)); return fd; });
      vi.mocked(writeFileSync).mockImplementation((path, data, options) => {
        const name = typeof path === 'number' ? opened.get(path) : String(path);
        if (name?.endsWith('-output.json')) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
        return actual.writeFileSync(path, data, options);
      });
      const result = await run(repo);
      expect(result.code, result.stdout).toBe(1);
      expect(result.stdout).toContain('保存できません');
      expect(result.stdout).not.toContain('記録：');
      expect(readFileSync(join(repo.root, 'impl.txt'), 'utf8')).toBe('unfinished');
      expect(existsSync(join(runDir(repo), 'summary.json'))).toBe(false);
      expect(repo.prs()).toEqual([]);
    } finally {
      vi.mocked(openSync).mockImplementation(actual.openSync);
      vi.mocked(writeFileSync).mockImplementation(actual.writeFileSync);
      repo.cleanup();
    }
  });
});
