import { relative } from 'node:path';
import { defineConfig } from 'vitest/config';
import { listTestFiles, loadConfig } from './scripts/test-files.mjs';

const root = import.meta.dirname;

export default defineConfig({
  test: {
    // verify が要件のテストとして数えるファイル（loomake.config.json の tests.dirs と tests.pattern）を、同じ規則で選んで実行する。
    // ファイルの一覧は起動時に決まるので、watch 中に足したテストファイルは再起動するまで実行されない
    // include は glob なので、Windows の区切り文字 \ を / にする
    include: listTestFiles(root, loadConfig(root).tests).map((f) => relative(root, f).replaceAll('\\', '/')),
  },
});
