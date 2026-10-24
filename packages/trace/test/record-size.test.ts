import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { UsageError } from '@loomake/kit';
import { buildReport, runRecord } from '@loomake/trace';
import { makeRepo, CHANGE } from '../../runner/test/helpers.js';

function doneRepo() {
  const repo = makeRepo({ tasks: '## 1. 実装\n- [x] 1.1 完了（REQ-012）\n' });
  repo.write('impl.txt', '実装\n'); repo.git('add', 'impl.txt'); repo.git('commit', '-q', '-m', 'implementation');
  return repo;
}

describe('生成した証拠と読み取り側の整合性', () => {
  it('[REQ-174] 通常の生成結果をreportで読める', () => {
    const repo = doneRepo();
    try {
      expect(runRecord({ root: repo.root, changeId: CHANGE, stdout: () => {} })).toBe(0);
      expect(buildReport(repo.root, CHANGE)?.evidence.ok).toBe(true);
    } finally { repo.cleanup(); }
  });

  it('[REQ-174] 64MiBを超える生成結果は証拠ファイルを作らず止まる', () => {
    const repo = doneRepo();
    try {
      expect(() => runRecord({ root: repo.root, changeId: CHANGE, stdout: () => {}, onVerify: (result) => { result.results[0].detail = 'x'.repeat(64 * 1024 * 1024); } })).toThrow(/証拠.*上限.*67108864/);
      expect(existsSync(join(repo.root, '.loomake/evidence', CHANGE))).toBe(false);
      expect(repo.git('status', '--porcelain')).toBe('');
    } finally { repo.cleanup(); }
  }, 30_000);

  it('[REQ-174] 形式が壊れた生成結果も保存しない', () => {
    const repo = doneRepo();
    try {
      expect(() => runRecord({ root: repo.root, changeId: CHANGE, stdout: () => {}, onVerify: (result) => { (result as { schemaVersion: string }).schemaVersion = 'other'; } })).toThrow(UsageError);
      expect(existsSync(join(repo.root, '.loomake/evidence', CHANGE))).toBe(false);
    } finally { repo.cleanup(); }
  });
});
