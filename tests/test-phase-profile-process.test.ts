import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(import.meta.dirname, '..');
const moduleUrl = pathToFileURL(join(root, 'scripts/test-phase-profile.mjs')).href;

describe('別プロセスの区間記録と保存', () => {
  it('[REQ-292][REQ-293] 子プロセス終了後も失敗結果と重複のない時間をJSON・要約へ残す', () => {
    const directory = mkdtempSync(join(tmpdir(), 'loomake-phase-process-'));
    const env = { ...process.env, LOOMAKE_TEST_PHASE_PROFILE_DIR: directory, LOOMAKE_TEST_PHASE_SAMPLE: '2', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '3', TEST_PHASE_OUTCOME: 'failure' };
    try {
      const source = `import {profileEvent as emit,CASE_IDS} from ${JSON.stringify(moduleUrl)};
        for (const id of CASE_IDS) {
          const at=(event,time,details={})=>emit(id,event,{at:time,...details});
          if(id==='shared-package-build'){at('package-build-start',0);at('package-build-end',50);continue;}
          at('test-start',0);at('test-outcome',99,{outcome:'failed'});at('test-end',100);
          at('cleanup-start',90);at('cleanup-end',95);
          if(id.startsWith('deadline-')){
            at('run-start',10);at('stall-start',30);at('run-end',70);at('retry-start',75);at('retry-end',85);
          }else{
            at('prepare-start',5);at('prepare-end',25);
            for(const kind of ['npm','git','cli'])at('command-timing',80,{kind,durationMs:10});
          }
        }
        process.exitCode=1;`;
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', source], { cwd: root, env, encoding: 'utf8' });
      expect(child.status, child.stderr).toBe(1);
      const collect = spawnSync(process.execPath, ['scripts/test-phase-profile.mjs'], { cwd: root, env, encoding: 'utf8' });
      expect(collect.status, collect.stderr).toBe(0);
      const profile = JSON.parse(readFileSync(join(directory, 'profile.json'), 'utf8'));
      expect(profile.complete).toBe(true);
      expect(profile.context).toMatchObject({ runId: '123', runAttempt: '3', sample: '2', testOutcome: 'failure' });
      expect(profile.context.checkoutSha).toMatch(/^[a-f0-9]{40}$/);
      expect(profile.cases.filter((row: {caseId: string}) => row.caseId !== 'shared-package-build').every((row: {outcome: string}) => row.outcome === 'failed')).toBe(true);
      const deadline = profile.cases.find((row: {caseId: string}) => row.caseId === 'deadline-push');
      expect(deadline.phases).toContainEqual({ name: 'before-stall', durationMs: 20 });
      expect(deadline.phases).toContainEqual({ name: 'stall-and-stop', durationMs: 40 });
      expect(readFileSync(join(directory, 'summary.md'), 'utf8')).toContain('停止前の処理');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('[REQ-292][REQ-293] 記録がない実行は保存を試み、不足と非ゼロ終了を返す', () => {
    const directory = mkdtempSync(join(tmpdir(), 'loomake-phase-missing-'));
    try {
      const result = spawnSync(process.execPath, ['scripts/test-phase-profile.mjs'], {
        cwd: root, env: { ...process.env, LOOMAKE_TEST_PHASE_PROFILE_DIR: directory }, encoding: 'utf8',
      });
      expect(result.status, result.stderr).toBe(1);
      const profile = JSON.parse(readFileSync(join(directory, 'profile.json'), 'utf8'));
      expect(profile.complete).toBe(false);
      expect(profile.cases.every((row: {totalMs: number | null, outcome: string}) => row.totalMs === null && row.outcome === 'unknown')).toBe(true);
      expect(readFileSync(join(directory, 'summary.md'), 'utf8')).toContain('未計測');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
