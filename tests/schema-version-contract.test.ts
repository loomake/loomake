import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

it('[REQ-276] 版付きの 2.0.0 の JSON Schema への削除・改名・版の変更を実際の検査が拒否し、既存の 8 試行も保つ', () => {
  const root = join(import.meta.dirname, '..');
  const target = join(root, '.loomake/quality', `schema-version-contract-${randomUUID()}`);
  try {
    const checked = spawnSync(process.execPath, ['scripts/schema-contract-check.mjs', target], { cwd: root, encoding: 'utf8', timeout: 240000 });
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    const result = JSON.parse(readFileSync(join(target, 'results.json'), 'utf8'));
    expect(result.ok).toBe(true);
    expect(result.originalsUnchanged).toBe(true);
    expect(result.trials.map((trial: { status: string }) => trial.status)).toEqual(['passed', 'rejected', 'rejected', 'rejected', 'rejected', 'rejected', 'passed', 'passed']);
    expect(result.versionTrials.map((trial: { id: string; status: string }) => [trial.id, trial.status])).toEqual([
      ['v2-baseline', 'passed'], ['v2-remove-root', 'rejected'], ['v2-rename-root', 'rejected'],
      ['v2-remove-item', 'rejected'], ['v2-rename-item', 'rejected'], ['v2-version', 'rejected'],
    ]);
    for (const trial of result.versionTrials.filter((trial: { expected: string }) => trial.expected === 'rejected')) {
      expect(trial.failedTests).toEqual([expect.stringContaining('[REQ-276][REQ-304] 版付きのファイルは公開した写しの必須プロパティと版をすべて保つ')]);
    }
    expect(result.sources.map((source: { file: string }) => source.file)).toContain('packages/core/schema/versions/verify-result-2.0.0.schema.json');
  } finally { rmSync(target, { recursive: true, force: true }); }
}, 260000);
