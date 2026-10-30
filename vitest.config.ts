import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';
import { filesFor, isPullRequestRun } from './tests/test-split.js';

const root = import.meta.dirname;
const packageTests = ['tests/ai-journeys.test.ts', 'tests/package-artifacts.test.ts'];
const fastFiles = filesFor('fast');
const slowFiles = filesFor('slow');
// loomake verify は、test コマンドがこのファイルに書き出した JSON レポートで、要件ごとのテストを判定する（add-verify-cli の仮定 A-05）
const report: string = JSON.parse(readFileSync(join(root, 'loomake.config.json'), 'utf8')).tests.report;

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
    // root が配布物を 1 回だけ準備し、選択された package/slow へ provide する。
    // ファイル指定だけでは余計に build することがある。unit だけなら --project unit を使う。
    globalSetup: ['tests/package-build.setup.ts'],
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/**/*.test.ts', 'packages/*/test/**/*.test.ts'], exclude: [...configDefaults.exclude, ...packageTests, '**/*.slow.test.ts', ...fastFiles.exclude] } },
      { extends: true, test: { name: 'package', include: packageTests, exclude: [...configDefaults.exclude, '**/*.slow.test.ts', ...fastFiles.exclude] } },
      ...(!isPullRequestRun() && slowFiles.include.length > 0 ? [{ extends: true as const, test: { name: 'slow', include: slowFiles.include } }] : []),
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
