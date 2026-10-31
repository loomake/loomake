import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

it('[REQ-053] 実際のスキーマ検査が削除・改名・minorだけの変更を拒否し、majorの変更を許可する', () => {
  const root = join(import.meta.dirname, '..');
  const target = join(root, '.loomake/quality', `schema-contract-${randomUUID()}`);
  try {
    const checked = spawnSync(process.execPath, ['scripts/schema-contract-check.mjs', target], { cwd: root, encoding: 'utf8', timeout: 240000 });
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
    const result = JSON.parse(readFileSync(join(target, 'results.json'), 'utf8'));
    expect(result.originalsUnchanged).toBe(true);
    expect(result.trials).toHaveLength(8);
    expect(result.trials.map((trial: { status: string }) => trial.status)).toEqual(['passed', 'rejected', 'rejected', 'rejected', 'rejected', 'rejected', 'passed', 'passed']);
    for (const trial of result.trials.filter((trial: { expected: string }) => trial.expected === 'rejected')) {
      expect(trial.failedTests).toEqual([expect.stringContaining('[REQ-053] 必須プロパティを削除・改名したら')]);
    }
    expect(result.branchTrials.map((trial: { id: string; status: string }) => [trial.id, trial.status])).toEqual([['branch-remove-ci', 'rejected']]);
    expect(result.branchTrials[0].failedTests).toEqual([expect.stringContaining('[REQ-053] 必須プロパティを削除・改名したら')]);
    const repeated = spawnSync(process.execPath, ['scripts/schema-contract-check.mjs', target], { cwd: root, encoding: 'utf8', timeout: 10000 });
    expect(repeated.status).toBe(1);
    expect(JSON.parse(readFileSync(join(target, 'results.json'), 'utf8'))).toEqual(result);
  } finally { rmSync(target, { recursive: true, force: true }); }
}, 260000);
