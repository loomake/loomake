// スクリプトが node で直接実行されたかを、argv[1] と import.meta.url の実体のパス（realpath）で比べる。
// macOS の一時ディレクトリ（/var → /private/var）のように、シンボリックリンクを通して起動すると
// 文字列のままでは食い違い、main が呼ばれないため（stabilize-cross-os-tests の A-08）
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** @param {string} moduleUrl 呼び出し側の import.meta.url */
export function isMain(moduleUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  try { return realpathSync(argv1) === realpathSync(fileURLToPath(moduleUrl)); } catch { return false; }
}
