import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(import.meta.dirname, '../scripts/ci-test-diagnostics.mjs');
const directories: string[] = [];
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'loomake-ci-diagnostic-process-'));
  directories.push(cwd);
  for (const args of [['init', '--quiet'], ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-qm', 'fixture']]) {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  }
  mkdirSync(join(cwd, '.loomake'));
  return cwd;
}
function invoke(cwd: string, outcome: string, overrides: Record<string, string> = {}) {
  return spawnSync(process.execPath, [script], {
    cwd, encoding: 'utf8', timeout: 10_000,
    env: { ...process.env, RUNNER_TEMP: cwd, GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'loomake/loomake', GITHUB_RUN_ID: '987', GITHUB_RUN_ATTEMPT: '3',
      CI_TEST_OS: 'windows-latest', CI_TEST_SHARD: '2/2', CI_TEST_OUTCOME: outcome, GITHUB_SHA: 'not-the-checked-out-commit',
      GITHUB_STEP_SUMMARY: join(cwd, 'step-summary.md'), GITHUB_OUTPUT: join(cwd, 'step-output.txt'), ...overrides },
  });
}
const report = (status: string) => JSON.stringify({ testResults: [{ name: 'fixture.test.ts', assertionResults: [{ fullName: '[REQ-284] child fixture', status, duration: 12 }] }] });

describe('CI 診断の子プロセス実行', () => {
  it.each([
    ['success', report('passed'), 'valid', '成功', 1, 0],
    ['failure', report('failed'), 'valid', '失敗', 0, 1],
    ['skipped', undefined, 'missing', '未実行', 0, 0],
    ['failure', '{invalid', 'invalid', '失敗', 0, 0],
  ] as const)('[REQ-283][REQ-284][REQ-285] %s と %s の診断を元の結果と区別して保存する', (outcome, raw, reportState, label, passed, failed) => {
    const cwd = fixture();
    if (raw !== undefined) writeFileSync(join(cwd, '.loomake/test-report.json'), raw);
    writeFileSync(join(cwd, '.loomake/unrelated.txt'), '保存しない');
    const result = invoke(cwd, outcome);
    expect(result.status, result.stderr).toBe(0);
    const directory = join(cwd, 'loomake-ci-test-diagnostics');
    const metadata = JSON.parse(readFileSync(join(directory, 'metadata.json'), 'utf8'));
    expect(metadata).toMatchObject({ schemaVersion: 1, runUrl: 'https://github.com/loomake/loomake/actions/runs/987', runId: '987', runAttempt: '3',
      checkoutSha: spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).stdout.trim(), os: 'windows-latest', node: process.version, shard: '2/2',
      testOutcome: outcome === 'skipped' ? 'not_run' : outcome, reportState, counts: { passed, failed } });
    const summary = readFileSync(join(directory, 'summary.md'), 'utf8');
    expect(readFileSync(join(cwd, 'step-summary.md'), 'utf8')).toBe(summary);
    expect(summary).toContain(`テストステップ：${label}`);
    if (reportState !== 'valid') expect(summary).toContain('レポートからテストの成功は確認できません');
    expect(readFileSync(join(cwd, 'step-output.txt'), 'utf8')).toBe(`artifact-name=ci-tests-987-3-windows-latest-2-2\ndirectory=${directory}\n`);
    expect(readdirSync(directory).sort()).toEqual(raw === undefined ? ['metadata.json', 'summary.md'] : ['metadata.json', 'summary.md', 'test-report.json']);
    if (raw !== undefined) expect(readFileSync(join(directory, 'test-report.json'), 'utf8')).toBe(raw);
    expect(existsSync(join(directory, 'unrelated.txt'))).toBe(false);
  }, 20_000);

  it('[REQ-285] 要約の追記が失敗しても生成済みの診断ファイルを残し、終了コードは非ゼロになる', () => {
    const cwd = fixture();
    writeFileSync(join(cwd, '.loomake/test-report.json'), report('failed'));
    const result = invoke(cwd, 'failure', { GITHUB_STEP_SUMMARY: cwd });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CI の診断情報を生成できませんでした');
    const directory = join(cwd, 'loomake-ci-test-diagnostics');
    expect(JSON.parse(readFileSync(join(directory, 'metadata.json'), 'utf8')).testOutcome).toBe('failure');
    expect(readdirSync(directory).sort()).toEqual(['metadata.json', 'summary.md', 'test-report.json']);
  }, 20_000);
});
