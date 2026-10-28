import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { artifactName, createDiagnostics } from '../scripts/ci-test-diagnostics.mjs';

const directories: string[] = [];
function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'loomake-ci-diagnostics-'));
  directories.push(cwd);
  spawnSync('git', ['init', '--quiet'], { cwd });
  spawnSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'fixture'], { cwd });
  mkdirSync(join(cwd, '.loomake'));
  return cwd;
}
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

const env = { GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'loomake/loomake', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2', RUNNER_OS: 'Windows', CI_TEST_OS: 'windows-latest', CI_TEST_SHARD: '1/2', CI_TEST_OUTCOME: 'failure' };

describe('CI のテスト診断', () => {
  it('[REQ-283] run・試行・OS・シャードごとに artifact 名を分ける', () => {
    expect(artifactName(env)).toBe('ci-tests-123-2-windows-latest-1-2');
    const variants = [env, { ...env, CI_TEST_SHARD: '2/2' }, { ...env, GITHUB_RUN_ATTEMPT: '3' }, { ...env, CI_TEST_OS: 'ubuntu-latest' }, { ...env, GITHUB_RUN_ID: '124' }];
    expect(new Set(variants.map(artifactName)).size).toBe(5);
    expect(artifactName({ ...env, CI_TEST_SHARD: '' })).toMatch(/-all$/);
  });

  it('[REQ-283] 実際の checkout SHA と Node 版を記録し、元レポートだけを写す', () => {
    const cwd = fixture();
    const raw = '{"testResults": []}\n';
    writeFileSync(join(cwd, '.loomake/test-report.json'), raw);
    writeFileSync(join(cwd, '.loomake/private.txt'), '保存対象外');
    const result = createDiagnostics({ cwd, env: { ...env, RUNNER_TEMP: cwd, GITHUB_SHA: 'pr-head-is-not-checkout' } });
    expect(result.metadata).toMatchObject({ schemaVersion: 1, runUrl: 'https://github.com/loomake/loomake/actions/runs/123', runId: '123', runAttempt: '2', os: 'windows-latest', node: process.version, shard: '1/2', testOutcome: 'failure' });
    expect(result.metadata.checkoutSha).toBe(spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).stdout.trim());
    expect(JSON.parse(readFileSync(join(result.directory, 'metadata.json'), 'utf8'))).toEqual(result.metadata);
    expect(readFileSync(join(result.directory, 'test-report.json'), 'utf8')).toBe(raw);
    expect(readdirSync(result.directory).sort()).toEqual(['metadata.json', 'test-report.json']);
    expect(createDiagnostics({ cwd, env: { RUNNER_TEMP: cwd, RUNNER_OS: 'Linux' } }).metadata).toMatchObject({ shard: 'all', os: 'Linux', testOutcome: 'not_run' });
  });
});
