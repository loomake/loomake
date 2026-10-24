import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

const root = import.meta.dirname;
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
    include: ['tests/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
    reporters: ['default', 'json'],
    outputFile: { json: report },
    // pnpm test:coverage で測る。配布するコードだけを対象にする
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: '.loomake/coverage',
      // 2026-10-24 の値（文 94.6%・分岐 88.5%・関数 96.5%・行 97.9%）より少し下に置き、下がったら CI で止める
      thresholds: { statements: 93, branches: 87, functions: 95, lines: 96 },
    },
  },
});
