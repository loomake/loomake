import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(import.meta.dirname, '..');
const moduleUrl = pathToFileURL(join(root, 'scripts/test-phase-profile.mjs')).href;

describe('別プロセスの予算時計の診断', () => {
  it('[REQ-295][REQ-296] 除外後の時間が予算内でも元の失敗と未計測の再実行を保存する', () => {
    const directory = mkdtempSync(join(tmpdir(), 'loomake-budget-clock-process-'));
    const env = { ...process.env, LOOMAKE_TEST_PHASE_PROFILE_DIR: directory, LOOMAKE_TEST_BUDGET_CLOCK: '1', TEST_PHASE_OUTCOME: 'failure' };
    try {
      const source = `import {profileEvent as emit} from ${JSON.stringify(moduleUrl)};
        const row=(caseId,event,at,details={})=>emit(caseId,event,{at,...details});
        row('deadline-push','test-start',0);
        row('deadline-push','run-start',0);
        row('deadline-push','stall-start',10000);
        row('deadline-push','run-end',46000);
        row('deadline-push','budget-clock',46000,{wallElapsedMs:46000,holderWaitMs:6000,budgetMs:40000,graceMs:3000});
        row('deadline-push','cleanup-start',46001);
        row('deadline-push','cleanup-end',46002);
        row('deadline-push','test-outcome',46003,{outcome:'failed'});
        row('deadline-push','test-end',46004);
        row('deadline-create','budget-clock',46000,{wallElapsedMs:40000,holderWaitMs:0,budgetMs:40000,graceMs:3000});
        process.exitCode=1;`;
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', source], { cwd: root, env, encoding: 'utf8' });
      expect(child.status, child.stderr).toBe(1);
      const collect = spawnSync(process.execPath, ['scripts/test-phase-profile.mjs'], { cwd: root, env, encoding: 'utf8' });
      expect(collect.status, collect.stderr).toBe(1);
      const profile = JSON.parse(readFileSync(join(directory, 'profile.json'), 'utf8'));
      expect(profile.context.testOutcome).toBe('failure');
      expect(profile.complete).toBe(false);
      expect(profile.budgetClocks.complete).toBe(true);
      const clock = profile.budgetClocks.cases.find((row: {caseId: string}) => row.caseId === 'deadline-push');
      expect(clock).toMatchObject({ wallElapsedMs: 46000, holderWaitMs: 6000, budgetElapsedMs: 40000, budgetMs: 40000, graceMs: 3000, complete: true });
      const test = profile.cases.find((row: {caseId: string}) => row.caseId === 'deadline-push');
      expect(test.outcome).toBe('failed');
      expect(test.missing).toContain('retry-start: 未計測');
      expect(test.missing).toContain('retry-end: 未計測');
      const summary = readFileSync(join(directory, 'summary.md'), 'utf8');
      expect(summary).toContain('46000');
      expect(summary).toContain('6000');
      expect(summary).toContain('40000');
      expect(summary).toContain('failed');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
