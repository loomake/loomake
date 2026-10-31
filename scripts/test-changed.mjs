#!/usr/bin/env node
// 手元の速い確認。origin/main との分岐点（git merge-base origin/main HEAD）から変えたファイル（コミット前の変更を含む）に
// 関係する試験だけを vitest で流す。origin/main は同じ名前のタグと取り違えないよう refs/remotes/ から書く。変更がなければ何もせずに成功する。全体の試験（pnpm test）の代わりではない（docs/testing.md）
//
//   pnpm test:changed [vitest の引数…]

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = spawnSync('git', ['merge-base', 'refs/remotes/origin/main', 'HEAD'], { cwd: root, encoding: 'utf8' });
if (base.status !== 0) {
  console.error(`test:changed: origin/main との分岐点を求められませんでした。git fetch origin を実行してから、もう一度試してください（${(base.stderr || base.error?.message || '').trim()}）`);
  process.exit(2);
}
// vitest の --changed は、指定したコミットから作業ツリーまでの差分に関係する試験だけを選ぶ。変更がなければ終了コード 0 で終わる
const result = spawnSync(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--changed', base.stdout.trim(), ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
