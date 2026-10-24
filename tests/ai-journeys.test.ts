import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('AIが作成・実行する配布物の操作試験', () => {
  it('[REQ-155][REQ-156][REQ-157] 導入・通常操作・失敗と復旧を実行し、操作結果を記録する', () => {
    const base = mkdtempSync(join(tmpdir(), 'loomake journeys '));
    const target = join(base, 'trial');
    try {
      const result = spawnSync(process.execPath, ['scripts/ai-journeys.mjs', target], { cwd: join(import.meta.dirname, '..'), encoding: 'utf8' });
      expect(result.status, result.stdout + result.stderr).toBe(0);
      const report = JSON.parse(readFileSync(join(target, 'journeys.json'), 'utf8'));
      expect(report.kind).toBe('ai-authored-scenarios');
      expect(report.humanParticipants).toBe(0);
      expect(report.externalGitHub).toBe(false);
      expect(report.scenarios).toHaveLength(3);
      expect(report.scenarios.every((s: { status: string }) => s.status === 'passed')).toBe(true);
      const steps = report.scenarios.flatMap((s: { steps: { args: string[]; expectedExitCode: number; exitCode: number }[] }) => s.steps);
      expect(steps.every((s: { expectedExitCode: number; exitCode: number }) => s.expectedExitCode === s.exitCode)).toBe(true);
      expect(steps.filter((s: { expectedExitCode: number }) => s.expectedExitCode === 1).length).toBeGreaterThanOrEqual(4);
      expect(steps.some((s: { args: string[] }) => s.args.includes('record'))).toBe(true);
      expect(steps.some((s: { args: string[] }) => s.args.includes('report'))).toBe(true);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  }, 60_000);
});
