import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runRun } from '@loomake/runner';
import { runReport } from '@loomake/trace';
import { CHANGE, makeRepo, type Repo } from './helpers.js';

vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  return { ...fs, mkdirSync: vi.fn(fs.mkdirSync), unlinkSync: vi.fn(fs.unlinkSync) };
});
afterEach(() => vi.clearAllMocks());

async function run(repo: Repo) {
  const out: string[] = [];
  const code = await runRun({ root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, stdout: (text) => out.push(text), env: repo.env, fileExists: () => false });
  return { code, stdout: out.join('\n') };
}

const firstSummary = (root: string) => {
  const dir = readdirSync(join(root, '.loomake/runs')).find((name) => name !== '.gitignore')!;
  return JSON.parse(readFileSync(join(root, '.loomake/runs', dir, 'summary.json'), 'utf8'));
};

describe('証拠保存失敗からの復旧', () => {
  it('[REQ-176] 保存先の作成失敗を停止記録に残し、復旧後は実装を繰り返さず完了する', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    const repo = makeRepo();
    try {
      repo.plan([{ write: { 'impl.txt': '実装\n' } }, {}]);
      const evidenceDir = join(repo.root, '.loomake/evidence', CHANGE);
      vi.mocked(mkdirSync).mockImplementation((path, options) => {
        if (resolve(String(path)) === evidenceDir) throw Object.assign(new Error('storage denied'), { code: 'EACCES' });
        return actual.mkdirSync(path, options);
      });
      const stopped = await run(repo);
      expect(stopped.code, stopped.stdout).toBe(1);
      expect(stopped.stdout).toContain('証拠');
      expect(firstSummary(repo.root).status).toBe('stopped');
      expect(firstSummary(repo.root).reason).toContain(evidenceDir);
      expect(repo.calls()).toHaveLength(2);
      expect(repo.prs()).toEqual([]);
      expect(existsSync(evidenceDir)).toBe(false);
      const commits = repo.git('rev-list', '--count', 'HEAD');
      expect(repo.git('log', '--format=%s')).not.toContain('evidence(c1)');
      vi.mocked(mkdirSync).mockImplementation(actual.mkdirSync);
      const resumed = await run(repo);
      expect(resumed.code, resumed.stdout).toBe(0);
      expect(repo.calls()).toHaveLength(2);
      expect(repo.prs()).toHaveLength(1);
      expect(readdirSync(evidenceDir)).toHaveLength(1);
      expect(Number(repo.git('rev-list', '--count', 'HEAD'))).toBe(Number(commits) + 1);
      expect(repo.git('status', '--porcelain')).toBe('');
    } finally {
      vi.mocked(mkdirSync).mockImplementation(actual.mkdirSync);
      repo.cleanup();
    }
  });
});


it('[REQ-176] 公開後の片付け失敗は確認・一時名の削除・証拠のコミットから復旧できる', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  const repo = makeRepo();
  try {
    repo.plan([{ write: { 'impl.txt': '実装\n' } }, {}]);
    vi.mocked(unlinkSync).mockImplementation((path) => {
      if (String(path).includes('.loomake-evidence-')) throw Object.assign(new Error('cleanup denied'), { code: 'EACCES' });
      return actual.unlinkSync(path);
    });
    const stopped = await run(repo);
    expect(stopped.code, stopped.stdout).toBe(1);
    expect(firstSummary(repo.root).reason).toContain('片付け');
    expect(repo.prs()).toEqual([]);
    const dir = join(repo.root, '.loomake/evidence', CHANGE);
    const names = readdirSync(dir);
    const temporary = names.find((name) => name.endsWith('.tmp'))!;
    const json = names.find((name) => name.endsWith('.json'))!;
    expect(names).toHaveLength(2);
    const completed = readFileSync(join(dir, json), 'utf8');
    expect(JSON.parse(completed).verify.ok).toBe(true);
    expect(runReport({ root: repo.root, changeId: CHANGE, stdout: () => {} })).toBe(0);
    expect(JSON.parse(completed).sha).toBe(repo.git('rev-parse', 'HEAD'));
    vi.mocked(unlinkSync).mockImplementation(actual.unlinkSync);
    unlinkSync(join(dir, temporary));
    repo.git('add', '--', `.loomake/evidence/${CHANGE}/${json}`);
    repo.git('commit', '-q', '-m', 'evidence(c1): recover completed evidence');
    const recovered = repo.git('rev-parse', 'HEAD');
    const resumed = await run(repo);
    expect(resumed.code, resumed.stdout).toBe(0);
    expect(repo.git('rev-parse', 'HEAD')).toBe(recovered);
    expect(repo.calls()).toHaveLength(2);
    expect(repo.prs()).toHaveLength(1);
    expect(readdirSync(dir)).toEqual([json]);
    expect(readFileSync(join(dir, json), 'utf8')).toBe(completed);
  } finally {
    vi.mocked(unlinkSync).mockImplementation(actual.unlinkSync);
    repo.cleanup();
  }
});
