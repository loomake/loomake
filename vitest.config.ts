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
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
    reporters: ['default', 'json'],
    outputFile: { json: report },
  },
});
