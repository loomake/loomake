import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { acquireRunLock } from '../src/lock.js';
import { makeRepo } from './helpers.js';

const pathOf = (repo: ReturnType<typeof makeRepo>) => join(repo.git('rev-parse', '--absolute-git-dir'), 'loomake-run.lock');
const deadOwner = () => ({ pid: 2_147_483_647, host: hostname(), token: 'ended-process' });

describe('作業ツリーの実行ロック', () => {
  it('[REQ-158] 二重取得を拒否し、解放後は再取得できる', () => {
    const repo = makeRepo();
    try {
      const release = acquireRunLock(repo.root, repo.env);
      expect(() => acquireRunLock(repo.root, repo.env)).toThrow('同じ作業ツリー');
      release();
      expect(existsSync(pathOf(repo))).toBe(false);
      acquireRunLock(repo.root, repo.env)();
      expect(repo.git('status', '--porcelain')).toBe('');
    } finally { repo.cleanup(); }
  });

  it('[REQ-159] 同じホストの終了済み所有者から回復する', () => {
    const repo = makeRepo();
    try {
      writeFileSync(pathOf(repo), JSON.stringify(deadOwner()));
      const release = acquireRunLock(repo.root, repo.env);
      expect(JSON.parse(readFileSync(pathOf(repo), 'utf8')).pid).toBe(process.pid);
      release();
      expect(existsSync(pathOf(repo) + '.recovery')).toBe(false);
    } finally { repo.cleanup(); }
  });

  it.each(['broken', JSON.stringify({ ...deadOwner(), host: hostname() + '.other' })])('[REQ-159] 不明か別ホストのロック %j を削除しない', (text) => {
    const repo = makeRepo();
    try {
      writeFileSync(pathOf(repo), text);
      expect(() => acquireRunLock(repo.root, repo.env)).toThrow('ロック');
      expect(readFileSync(pathOf(repo), 'utf8')).toBe(text);
    } finally { repo.cleanup(); }
  });

  it('[REQ-159] 回復処理が重なったときは元のロックを削除しない', () => {
    const repo = makeRepo();
    try {
      const text = JSON.stringify(deadOwner());
      writeFileSync(pathOf(repo), text);
      writeFileSync(pathOf(repo) + '.recovery', 'other recovery');
      expect(() => acquireRunLock(repo.root, repo.env)).toThrow('回復');
      expect(readFileSync(pathOf(repo), 'utf8')).toBe(text);
      rmSync(pathOf(repo) + '.recovery');
      acquireRunLock(repo.root, repo.env)();
    } finally { repo.cleanup(); }
  });

  it('[REQ-159] 所有トークンが異なるロックを解放しない', () => {
    const repo = makeRepo();
    try {
      const release = acquireRunLock(repo.root, repo.env);
      const current = JSON.parse(readFileSync(pathOf(repo), 'utf8'));
      const replacement = JSON.stringify({ ...current, token: 'replacement' });
      writeFileSync(pathOf(repo), replacement);
      release();
      expect(readFileSync(pathOf(repo), 'utf8')).toBe(replacement);
    } finally { repo.cleanup(); }
  });
});
