import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';
import { assertNotPartitioned, loadPartition, partitionFiles } from './scripts/lib/test-partition.mjs';
import { CiTestSequencer } from './scripts/lib/ci-test-sequencer.mjs';

const root = import.meta.dirname;
const packageTests = ['tests/ai-journeys.test.ts', 'tests/package-artifacts.test.ts', 'tests/pending-approvals-cli.test.ts'];
// loomake verify は、test コマンドがこのファイルに書き出した JSON レポートで、要件ごとのテストを判定する（add-verify-cli の仮定 A-05）
const report: string = JSON.parse(readFileSync(join(root, 'loomake.config.json'), 'utf8')).tests.report;
// CI の macOS・Windows のシャードでは、隔離一覧（tests/quarantine.json）でその OS に指定したファイルを除く（REQ-214・REQ-344）。
// 一覧は scripts/ci-quarantine.mjs が検査し、除くファイルを JSON の配列で渡す。指定がなければ何も除かない
const quarantined: string[] = (() => {
  const value = process.env.LOOMAKE_TEST_QUARANTINE_EXCLUDE;
  if (!value) return [];
  const files: unknown = JSON.parse(value);
  if (!Array.isArray(files) || !files.every((file) => typeof file === 'string' && /^[A-Za-z0-9._/-]+\.test\.ts$/.test(file))) {
    throw new Error(`LOOMAKE_TEST_QUARANTINE_EXCLUDE は試験ファイルの JSON の配列にしてください：${value}`);
  }
  return files;
})();
const partition = loadPartition(root);
assertNotPartitioned(quarantined, partition);
const files = partitionFiles(partition);

export default defineConfig({
  resolve: {
    // ビルドの前でも、ワークスペースのパッケージを src から読む
    alias: {
      '@loomake/core': join(root, 'packages/core/src/index.ts'),
      '@loomake/kit': join(root, 'packages/kit/src/index.ts'),
      '@loomake/trace': join(root, 'packages/trace/src/index.ts'),
      '@loomake/runner': join(root, 'packages/runner/src/index.ts'),
    },
  },
  test: {
    sequence: { sequencer: CiTestSequencer },
    // package/slow に同じ配布物を渡す。明示ファイル選択でも project が残る場合は準備を1回行う。
    globalSetup: ['tests/package-build.setup.ts'],
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/**/*.test.ts', 'packages/*/test/**/*.test.ts'], exclude: [...configDefaults.exclude, ...packageTests, ...files.companions, ...files.fastExclude, ...quarantined] } },
      { extends: true, test: { name: 'package', include: packageTests, exclude: [...configDefaults.exclude, ...files.companions, ...files.fastExclude, ...quarantined] } },
      ...(files.slowInclude.length ? [{ extends: true as const, test: { name: 'slow', include: files.slowInclude } }] : []),
    ],
    reporters: ['default', 'json'],
    outputFile: { json: report },
    // pnpm test:coverage で測る。配布するコードだけを対象にする
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: '.loomake/coverage',
      // 2026-10-24 の値（文 95.3%・分岐 90.2%・関数 96.9%・行 98.1%）より少し下に置き、下がったら CI で止める
      thresholds: { statements: 94, branches: 89, functions: 96, lines: 97 },
    },
  },
});
