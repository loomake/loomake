#!/usr/bin/env node
// CI の完了ゲート。対象の change を、PR 本文の「loomake-change:」の行、PR で変えたファイル、ブランチ名から決め、
// それぞれに --change <id> --done を実行する（REQ-010・REQ-132）。
// loomake run が作る loomake/<id> のブランチは、先頭の loomake/ を除いて比べる（fix-review-findings の仮定 A-01）
//
//   BASE_REF=<向き先のブランチ> PR_NUMBER=<PR の番号> node scripts/ci-gate.mjs <branch>
//
// PR 本文は、実行のたびに gh で読む。本文を書き直したら、gate のジョブを再実行すれば反映される（make-ci-change-selection-explicit の仮定 A-03）。
// PR_BODY を渡せば、gh を使わずにその文を本文として使う

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// change は changes/ の直下のディレクトリだけ。changes/archive/ は完了した change の置き場で、change ではない
const isChangeName = (name) => /^[^/\\.][^/\\]*$/.test(name) && name !== 'archive';
const isChangeDir = (changesDir, name) => isChangeName(name) && existsSync(join(changesDir, name)) && statSync(join(changesDir, name)).isDirectory();

/** ブランチ名から決めた verify の引数。一致する change がなければ空 */
export function verifyArgs(ref, changesDir) {
  const branch = ref.replace(/^loomake\//, '');
  return isChangeDir(changesDir, branch) ? ['--change', branch, '--done'] : [];
}

/** PR 本文の「loomake-change:」の行に書いた change-id。行がなければ undefined、none なら空 */
export function declaredChanges(body) {
  const m = body.match(/^[ \t]*loomake-change:[ \t]*(.*?)[ \t]*\r?$/m);
  if (!m) return undefined;
  if (m[1].toLowerCase() === 'none') return [];
  return [...new Set(m[1].split(',').map((s) => s.trim()).filter(Boolean))];
}

// 文書とみなすファイル。ほかはすべてコードとみなす（make-ci-change-selection-explicit の仮定 A-01）
const isDocument = (f) => f.endsWith('.md') || /^(docs|openspec|\.changeset)\//.test(f);

/**
 * 対象の change を決める。明示があれば明示だけを、なければ変えたファイルとブランチ名から決めた change を合わせて使う（仮定 A-02）。
 * 返すのは { changes }・{ qualityOnly: 理由 }・{ error: 理由 } のどれか
 */
export function selectChanges({ ref = '', body = '', files = [], changesDir, changesPrefix = 'openspec/changes/' }) {
  const declared = declaredChanges(body);
  if (declared) {
    if (!declared.length) return { qualityOnly: 'PR 本文で、change のない PR だと明示しています' };
    const missing = declared.filter((id) => !isChangeDir(changesDir, id));
    if (missing.length) return { error: `PR 本文の loomake-change: に書いた change がありません：${missing.join('、')}` };
    return { changes: declared };
  }
  const fromFiles = files.filter((f) => f.startsWith(changesPrefix)).map((f) => f.slice(changesPrefix.length).split('/')[0]);
  const fromBranch = verifyArgs(ref, changesDir)[1];
  const changes = [...new Set([...fromFiles, fromBranch].filter((id) => id && isChangeDir(changesDir, id)))].sort();
  if (changes.length) return { changes };
  if (files.every(isDocument)) return { qualityOnly: '対象の change がなく、変えたのは文書だけです' };
  return {
    error:
      'コードを変えていますが、対象の change を特定できませんでした。PR 本文に「loomake-change: <change-id>」の行を書いてください。change のない PR なら「loomake-change: none」と書いてください',
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const branch = process.argv[2] ?? '';
  const base = process.env.BASE_REF ?? '';
  let files = [];
  if (base) {
    const r = spawnSync('git', ['diff', '--name-only', `origin/${base}...HEAD`], { encoding: 'utf8' });
    if (r.status !== 0) {
      console.error(`ci-gate: PR で変えたファイルを調べられませんでした（${(r.stderr || '').trim()}）`);
      process.exit(1);
    }
    files = r.stdout.split('\n').filter(Boolean);
  }
  let body = process.env.PR_BODY ?? '';
  if (process.env.PR_BODY === undefined && process.env.PR_NUMBER) {
    const r = spawnSync('gh', ['pr', 'view', process.env.PR_NUMBER, '--json', 'body', '-q', '.body'], { encoding: 'utf8' });
    if (r.status !== 0) {
      console.error(`ci-gate: PR 本文を読めませんでした（${(r.stderr || r.error?.message || '').trim()}）`);
      process.exit(1);
    }
    body = r.stdout;
  }
  const selected = selectChanges({ ref: branch, body, files, changesDir: join('openspec', 'changes') });
  if (selected.error) {
    console.error(`ci-gate: ${selected.error}`);
    process.exit(1);
  }
  // loomake verify は先に pnpm build しておく（CI の gate ジョブ）
  const verify = (args) => spawnSync(process.execPath, ['packages/cli/dist/cli.js', 'verify', ...args], { stdio: 'inherit' }).status ?? 1;
  if (selected.qualityOnly) {
    console.error(`ci-gate: branch=${branch || '(なし)'} → verify（品質コマンドのみ。${selected.qualityOnly}）`);
    process.exit(verify([]));
  }
  let failed = false;
  for (const id of selected.changes) {
    console.error(`ci-gate: branch=${branch || '(なし)'} → verify --change ${id} --done`);
    if (verify(['--change', id, '--done']) !== 0) failed = true;
  }
  process.exit(failed ? 1 : 0);
}
