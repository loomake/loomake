import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// pnpm test:changed（scripts/test-changed.mjs）。開発の仕組みなので要件 ID は付けない（ADR 0005）
const script = join(import.meta.dirname, '..', 'scripts', 'test-changed.mjs');

describe('pnpm test:changed', () => {
  it('origin/main との分岐点を求められないときは、試験を流さずに終了コード 2 で止まる', () => {
    const dir = mkdtempSync(join(tmpdir(), 'loomake-test-changed-'));
    try {
      // スクリプトは自分の置き場所からリポジトリの根を決めるので、origin/main のない git リポジトリに写して起動する
      mkdirSync(join(dir, 'scripts'));
      copyFileSync(script, join(dir, 'scripts', 'test-changed.mjs'));
      const git = (...args: string[]) => spawnSync('git', ['-c', 'user.name=t', '-c', 'commit.gpgsign=false', '-c', 'user.email=t@example.com', ...args], { cwd: dir, encoding: 'utf8' });
      expect(git('init', '-q').status).toBe(0);
      expect(git('add', '.').status).toBe(0);
      expect(git('commit', '-q', '-m', 'init').status).toBe(0);
      const result = spawnSync(process.execPath, [join(dir, 'scripts', 'test-changed.mjs')], { cwd: dir, encoding: 'utf8' });
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('test:changed: origin/main との分岐点を求められませんでした');
      expect(result.stdout).not.toContain('vitest');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
