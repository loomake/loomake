import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '.agents/**', '.claude/**', 'openspec/**', '.trial/**', '.loomake/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // 配布するコードには型情報を使う規則を当てる。テストには Promise の扱いの規則だけを当てる
  {
    files: ['packages/*/src/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    // 利用者に見せる日本語のメッセージは 1 つの文字列のまま読めるよう、文字列とコメントは数えない
    rules: { 'max-len': ['error', { code: 160, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreComments: true, ignoreRegExpLiterals: true, ignoreUrls: true }] },
  },
  {
    files: ['packages/*/test/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },
  {
    files: ['packages/kit/supervisor/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { require: 'readonly', process: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
);
