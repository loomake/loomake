import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // verify が要件のテストとして数えるファイル（loomake.config.json の tests.dirs と tests.pattern）を、すべて実行する
    include: ['{tests,test,server,app,src,packages}/**/*.{test,spec}.{ts,tsx,js,mjs,cjs,vue}'],
  },
});
