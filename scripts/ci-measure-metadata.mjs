#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { isMain } from './lib/is-main.mjs';

// 旧測定の15file、期限試験の移動先2file、schema2file。全件実行でも、この対象の欠落を見落とさない。
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
  'packages/runner/test/run-timeout.test.ts',
  'packages/runner/test/external-budget-deadline.test.ts',
  'tests/schema-compatibility.test.ts',
  'tests/schema-version-contract.test.ts',
]);

/** @param {string} root @param {string} report */
function collectedFiles(root, report) {
  try {
    const data = JSON.parse(readFileSync(report, 'utf8'));
    if (!data || !Array.isArray(data.testResults)) throw new Error();
    const roots = [resolve(root), realpathSync(root)];
    const files = data.testResults.map((suite) => {
      if (!suite || typeof suite.name !== 'string' || !isAbsolute(suite.name)) throw new Error();
      const file = roots.map((base) => relative(base, suite.name).replaceAll('\\', '/'))
        .find((name) => /^(?:tests|packages\/[^/]+\/test)\/.+\.test\.ts$/.test(name) && !name.split('/').includes('..'));
      if (!file) throw new Error();
      return file;
    });
    return { collectionState: 'recorded', files, missingRequiredFiles: MEASURE_TEST_FILES.filter((file) => !files.includes(file)) };
  } catch {
    return { collectionState: 'invalid', files: null, missingRequiredFiles: null };
  }
}

/** @param {string} path */
function identity(path) {
  const { dev, ino } = statSync(path, { bigint: true });
  return `${dev}:${ino}`;
}

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
  const target = join(directory, 'test-report.json');
  const sourceParent = dirname(resolve(source));
  const targetParent = dirname(resolve(target));
  const sameParent = existsSync(sourceParent) && existsSync(targetParent) && identity(sourceParent) === identity(targetParent);
  if (resolve(source) === resolve(target) || sameParent || (reportPresent && existsSync(target) && identity(source) === identity(target))) {
    throw new Error('計測結果の保存先は元レポートと別にしてください');
  }
  mkdirSync(directory, { recursive: true });
  rmSync(target, { force: true });
  if (reportPresent) copyFileSync(source, target);
  // metadataの一覧は、保存したraw reportの実suiteから取る。欠損・不正を空集合にしない。
  const collection = reportPresent ? collectedFiles(root, target) : { collectionState: 'missing', files: null, missingRequiredFiles: null };
  const metadata = { schemaVersion: 2, selection: 'all', checkoutSha, node: process.version, os: process.platform, sample, requiredFiles: MEASURE_TEST_FILES, ...collection, testOutcome, reportPresent };
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
