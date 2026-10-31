#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { isMain } from './lib/is-main.mjs';

export const MEASURE_TEST_FILES = Object.freeze([
  'packages/runner/test/external-budget.test.ts',
  'tests/ai-journeys.test.ts',
  'tests/domain-mutations.test.ts',
  'tests/package-artifacts.test.ts',
  'packages/runner/test/publication-retry.test.ts',
  'packages/runner/test/evidence-storage.test.ts',
  'packages/runner/test/auth-prompts.test.ts',
  'packages/runner/test/engine-long-deadline.test.ts',
  'packages/runner/test/guards.test.ts',
  'packages/runner/test/pr.test.ts',
  'packages/runner/test/run-no-change.test.ts',
  'packages/runner/test/run.test.ts',
  'packages/runner/test/scenario-timeout-evidence.test.ts',
  'packages/runner/test/signal-during-sync.test.ts',
  'tests/domain-mutations-conditions.test.ts',
]);

/** @param {string} root @param {string} directory @param {number} sample @param {string} testOutcome */
export function saveMeasureMetadata(root, directory, sample, testOutcome) {
  if (![1, 2, 3].includes(sample) || !['success', 'failure', 'skipped', 'cancelled'].includes(testOutcome)) {
    throw new Error('sample は 1〜3、outcome は試験ステップの結果を指定してください');
  }
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const checkoutSha = git.stdout?.trim();
  if (git.status !== 0 || !/^[a-f0-9]{40}$/.test(checkoutSha)) throw new Error('実際の checkout SHA を取得できません');
  const source = join(root, '.loomake/test-report.json');
  const reportPresent = existsSync(source);
  mkdirSync(directory, { recursive: true });
  const target = join(directory, 'test-report.json');
  rmSync(target, { force: true });
  if (reportPresent) copyFileSync(source, target);
  const metadata = { schemaVersion: 1, checkoutSha, node: process.version, os: process.platform, sample, files: MEASURE_TEST_FILES, testOutcome, reportPresent };
  writeFileSync(join(directory, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
  return metadata;
}

if (isMain(import.meta.url)) {
  try {
    const [directory, sample, outcome, extra] = process.argv.slice(2);
    if (!directory || extra !== undefined) throw new Error('保存先・sample・outcome を指定してください');
    saveMeasureMetadata(fileURLToPath(new URL('..', import.meta.url)), directory, Number(sample), outcome);
  } catch {
    console.error('計測metadataを保存できませんでした');
    process.exitCode = 1;
  }
}
