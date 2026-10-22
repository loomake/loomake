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
  const dir = branch ? join(changesDir, branch) : '';
  if (dir && existsSync(dir) && statSync(dir).isDirectory()) return ['--change', branch, '--done'];
  return [];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const branch = process.argv[2] ?? '';
  const args = verifyArgs(branch, join('openspec', 'changes'));
  console.error(`ci-gate: branch=${branch || '(なし)'} → verify ${args.join(' ') || '（品質コマンドのみ）'}`);
  const r = spawnSync(process.execPath, ['scripts/verify.mjs', ...args], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
