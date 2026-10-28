#!/usr/bin/env node
// quality ジョブのテスト結果を、checkout したコミットと実行環境に結び付ける。
import { appendFileSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @param {Record<string, string | undefined>} env */
export function artifactName(env) {
  const part = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, '-');
  return `ci-tests-${part(env.GITHUB_RUN_ID || 'unknown')}-${part(env.GITHUB_RUN_ATTEMPT || '1')}-${part(env.CI_TEST_OS || env.RUNNER_OS || process.platform)}-${part(env.CI_TEST_SHARD || 'all')}`;
}

/** @param {{cwd?: string, env?: Record<string, string | undefined>, reportPath?: string, outputDir?: string}} options */
export function createDiagnostics({ cwd = process.cwd(), env = process.env, reportPath = join(cwd, '.loomake/test-report.json'), outputDir = join(env.RUNNER_TEMP || cwd, 'loomake-ci-test-diagnostics') } = {}) {
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' });
  if (git.status !== 0) throw new Error('checkout した SHA を取得できませんでした');
  const metadata = {
    schemaVersion: 1,
    runUrl: `${env.GITHUB_SERVER_URL || 'https://github.com'}/${env.GITHUB_REPOSITORY || ''}/actions/runs/${env.GITHUB_RUN_ID || ''}`,
    runId: env.GITHUB_RUN_ID || '',
    runAttempt: env.GITHUB_RUN_ATTEMPT || '1',
    checkoutSha: git.stdout.trim(),
    os: env.CI_TEST_OS || env.RUNNER_OS || process.platform,
    node: process.version,
    shard: env.CI_TEST_SHARD || 'all',
    testOutcome: ['success', 'failure'].includes(env.CI_TEST_OUTCOME) ? env.CI_TEST_OUTCOME : 'not_run',
  };
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
  if (existsSync(reportPath)) copyFileSync(reportPath, join(outputDir, 'test-report.json'));
  return { metadata, directory: outputDir, artifactName: artifactName(env) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = createDiagnostics();
    const output = `artifact-name=${result.artifactName}\ndirectory=${result.directory}\n`;
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
    else process.stdout.write(output);
  } catch (error) {
    console.error(`CI の診断情報を生成できませんでした：${error.message}`);
    process.exitCode = 1;
  }
}
