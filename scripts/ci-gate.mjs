#!/usr/bin/env node
// CI の完了ゲート。PR のブランチ名が openspec/changes/<id> と一致すれば --change <id> --done、
// 一致しなければ品質コマンドだけを実行する（setup-monorepo の design.md）。
//
//   node scripts/ci-gate.mjs <branch>

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function verifyArgs(branch, changesDir) {
  // change は changes/ の直下のディレクトリだけ。changes/archive/ は完了した change の置き場で、change ではない
  const isChangeName = /^[^/\\.][^/\\]*$/.test(branch) && branch !== 'archive';
  const dir = isChangeName ? join(changesDir, branch) : '';
  if (dir && existsSync(dir) && statSync(dir).isDirectory()) return ['--change', branch, '--done'];
  return [];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const branch = process.argv[2] ?? '';
  const args = verifyArgs(branch, join('openspec', 'changes'));
  console.error(`ci-gate: branch=${branch || '(なし)'} → verify ${args.join(' ') || '（品質コマンドのみ）'}`);
  // loomake verify は先に pnpm build しておく（CI の gate ジョブ）
  const r = spawnSync(process.execPath, ['packages/cli/dist/cli.js', 'verify', ...args], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
