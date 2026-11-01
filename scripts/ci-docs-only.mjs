#!/usr/bin/env node
// CI の quality ジョブで、PR の段階が L1（文書だけ）かを判定する（REQ-270・REQ-342）。段階の決め方は ci-tier.mjs で、完了ゲートと同じ。
// 文書だけなら、quality ジョブは品質コマンドを飛ばして成功する。必須チェックのジョブが同じ名前で結果を報告するよう、
// ワークフローの paths フィルタではなく、ジョブの中のステップでこのスクリプトを実行する。
//
//   EVENT_NAME=<github.event_name> BASE_REF=<向き先のブランチ> node scripts/ci-docs-only.mjs
//
// 結果は GITHUB_OUTPUT に docs_only=true か docs_only=false を書く（GITHUB_OUTPUT がなければ標準出力に書く）。
// 判定できないときは、すべて false（品質コマンドを実行する）にする。

import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { archiveMetadataPaths, decideTier, formatTierLine, isDocumentPath, isSpecPath } from './ci-tier.mjs';

// 文書として扱うファイルの判定は、完了ゲートの段階の判定と共有する（ci-tier.mjs）。ここからも同じ名前で使えるようにする
export { isDocumentPath } from './ci-tier.mjs';

/**
 * `git diff --raw -z` の出力から、変わったファイルごとに、状態・変更前と変更後のモード・パスを取り出す。
 * 名前の変更とコピーは、変更前と変更後の両方のパスを返す。解釈できない出力なら例外を投げる
 * @param {string} text
 * @returns {{ status: string; modes: [string, string]; paths: string[] }[]}
 */
export function parseRawDiff(text) {
  if (typeof text !== 'string') throw new Error('差分の出力がありません');
  if (text === '') return [];
  if (!text.endsWith('\0')) throw new Error('差分の出力が NUL で終わっていません');
  const fields = text.slice(0, -1).split('\0');
  const entries = [];
  for (let i = 0; i < fields.length; ) {
    const header = fields[i++];
    const m = /^:([0-7]{6}) ([0-7]{6}) [0-9a-f]+ [0-9a-f]+ (\S+)$/.exec(header);
    if (!m) throw new Error(`解釈できない差分の行です：${JSON.stringify(header)}`);
    const [, src, dst, status] = m;
    const count = /^[RC]\d{0,3}$/.test(status) ? 2 : /^[AMDT]$/.test(status) ? 1 : 0;
    if (!count) throw new Error(`解釈できない差分の状態です：${JSON.stringify(status)}`);
    const paths = [];
    for (let n = 0; n < count; n++) {
      const path = fields[i++];
      if (!path) throw new Error(`差分のパスが足りません：${status}`);
      paths.push(path);
    }
    entries.push({ status, modes: [src, dst], paths });
  }
  return entries;
}

/**
 * 差分と同じ merge-base の spec と、候補の完全 blob OID を遅延して読む（REQ-362）。
 * gate と quality は同じ読取と失敗時の判定を使う。
 * @param {(args: string[]) => { status: number | null; stdout?: string }} git
 * @param {string} baseRef
 */
export function comparisonReaders(git, baseRef) {
  let mergeBase;
  const base = () => {
    if (mergeBase === undefined) {
      const result = git(['merge-base', `refs/remotes/origin/${baseRef}`, 'HEAD']);
      mergeBase = result.status === 0 ? (result.stdout ?? '').trim() : '';
    }
    return mergeBase;
  };
  const readSpec = (side, path) => {
    const ref = side === 'new' ? 'HEAD' : base();
    if (!ref) return undefined;
    const result = git(['show', `${ref}:${path}`]);
    return result.status === 0 ? result.stdout : undefined;
  };
  const blobs = new Map();
  const sameBlob = (from, to) => {
    const key = `${from}\0${to}`;
    if (!blobs.has(key)) {
      const ref = base();
      let equal = false;
      if (ref) {
        const result = git(['rev-parse', `${ref}:${from}`, `HEAD:${to}`]);
        const ids = (result.stdout ?? '').replace(/\r?\n$/, '').split(/\r?\n/);
        equal = result.status === 0 && ids.length === 2 && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(ids[0]) && ids[0] === ids[1];
      }
      blobs.set(key, equal);
    }
    return blobs.get(key);
  };
  return { readSpec, sameBlob };
}

// 文書として扱うのは通常のファイル（100644）だけ。ファイルがない側（足したファイルの変更前、消したファイルの変更後）は 000000（REQ-282）
const isRegularOrAbsent = (mode) => mode === '100644' || mode === '000000';
const modeNames = { '120000': 'シンボリックリンク', '160000': 'サブモジュール', '100755': '実行できるファイル' };

const list = (paths) => paths.slice(0, 5).join('、') + (paths.length > 5 ? ` ほか ${paths.length - 5} 件` : '');

/**
 * 文書だけ（段階 L1）の PR かを決める。PR でないとき、差分を取れないとき、差分を解釈できないときは、文書だけとしない
 * @param {{ eventName?: string; baseRef?: string; git: (args: string[]) => { status: number | null; stdout?: string; stderr?: string; error?: Error } }} options
 * @returns {{ docsOnly: boolean; reason: string }}
 */
export function decideDocsOnly({ eventName = '', baseRef = '', git }) {
  if (eventName !== 'pull_request') return { docsOnly: false, reason: `PR ではない実行（${eventName || '不明'}）なので、すべてのステップを実行します` };
  if (!baseRef) return { docsOnly: false, reason: 'PR の向き先のブランチが分からないので、すべてのステップを実行します' };
  // PR のマージ先を変えても、CI は再実行されない（pull_request の既定の種類に edited がない）。
  // 積み重ねた PR のマージ先を main に変えたときに古い判定が残らないよう、main 向きの PR だけを判定する
  if (baseRef !== 'main') return { docsOnly: false, reason: `PR のマージ先が main ではない（${baseRef}）ので、すべてのステップを実行します` };
  // ベースから PR の先頭までのすべてのコミットの差分を使う。-M で名前の変更を検出し、変更前のパスも判定する。
  // ベースは refs/remotes/ から書く。「origin/main」とだけ書くと、同じ名前のタグやブランチ（refs/tags/origin/main など）が
  // 先に選ばれ、PR のコミットの途中をベースにして、コードの変更を差分から落とすことがある
  // --raw でモードも読み、シンボリックリンク・サブモジュール・モードの変更を見分ける（REQ-282）
  const r = git(['diff', '--raw', '-z', '-M', `refs/remotes/origin/${baseRef}...HEAD`]);
  if (r.status !== 0) {
    const detail = (r.stderr || r.error?.message || '').trim();
    return { docsOnly: false, reason: `PR で変えたファイルを調べられなかったので、すべてのステップを実行します（${detail || `終了コード ${r.status}`}）` };
  }
  let entries;
  try {
    entries = parseRawDiff(r.stdout ?? '');
  } catch (error) {
    return { docsOnly: false, reason: `PR の差分を解釈できなかったので、すべてのステップを実行します（${error.message}）` };
  }
  // 変えたファイルが 1 つもない差分は、解釈できない差分と同じに扱う
  if (!entries.length) return { docsOnly: false, reason: 'PR で変えたファイルが見つからなかったので、すべてのステップを実行します' };
  const { readSpec, sameBlob } = comparisonReaders(git, baseRef);
  const metadata = archiveMetadataPaths(entries, sameBlob);
  const paths = entries.flatMap((entry) => entry.paths);
  const others = [...new Set(paths.filter((path) => !isDocumentPath(path) && !metadata.has(path)))];
  if (others.length) return { docsOnly: false, reason: `文書ではないファイルを変えているので、すべてのステップを実行します：${list(others)}` };
  const irregular = entries.filter((entry) => !entry.modes.every(isRegularOrAbsent) || entry.modes.every((mode) => mode === '000000'));
  if (irregular.length) {
    const shown = irregular.map((entry) => `${entry.paths.at(-1)}（${[...new Set(entry.modes.filter((mode) => !isRegularOrAbsent(mode)).map((mode) => modeNames[mode] ?? `モード ${mode}`))].join('・') || 'モードなし'}）`);
    return { docsOnly: false, reason: `通常のファイルでないものを変えているので、すべてのステップを実行します：${list(shown)}` };
  }
  // macOS と Windows の checkout では、大文字と小文字だけが違うパスは 1 つのファイルに重なる（REQ-281）
  const tree = git(['ls-tree', '-r', '-z', '--name-only', 'HEAD']);
  if (tree.status !== 0) {
    const detail = (tree.stderr || tree.error?.message || '').trim();
    return { docsOnly: false, reason: `PR の先頭のファイルの一覧を読めなかったので、すべてのステップを実行します（${detail || `終了コード ${tree.status}`}）` };
  }
  const treeText = tree.stdout ?? '';
  if (treeText && !treeText.endsWith('\0')) return { docsOnly: false, reason: 'PR の先頭のファイルの一覧を解釈できなかったので、すべてのステップを実行します（NUL で終わっていません）' };
  const byFolded = new Map();
  for (const path of treeText.split('\0').filter(Boolean)) byFolded.set(path.toLowerCase(), [...(byFolded.get(path.toLowerCase()) ?? []), path]);
  const colliding = [...new Set(paths.filter((path) => (byFolded.get(path.toLowerCase()) ?? []).some((other) => other !== path)))];
  if (colliding.length) return { docsOnly: false, reason: `大文字と小文字だけが違う別のパスがあるので、すべてのステップを実行します：${list(colliding)}` };
  // Requirement の本文を変えた spec.md は文書だけと扱わない（段階 L3）。spec.md の差分だけを -U0 で読む（REQ-342）
  let specDiff = '';
  const specPaths = [...new Set(paths.filter(isSpecPath))];
  if (specPaths.length) {
    const d = git(['-c', 'core.quotePath=false', 'diff', '-U0', `refs/remotes/origin/${baseRef}...HEAD`, '--', ...specPaths]);
    if (d.status !== 0) {
      const detail = (d.stderr || d.error?.message || '').trim();
      return { docsOnly: false, reason: `spec.md の差分を読めなかったので、すべてのステップを実行します（${detail || `終了コード ${d.status}`}）` };
    }
    specDiff = d.stdout ?? '';
  }
  // PR 本文は読まない（quality ジョブは本文を読む権限を持たない。tier-ci-gate の仮定 A-03）
  // 消した行の節は、差分と同じ起点（ベースと HEAD の merge-base）のファイルで判定する
  const decided = decideTier({ entries, specDiff, readSpec, sameBlob });
  if (decided.error) return { docsOnly: false, reason: `段階を決められなかったので、すべてのステップを実行します（${decided.error}）` };
  if (decided.tier !== 'L1') return { docsOnly: false, reason: `段階が ${decided.tier} なので、すべてのステップを実行します（${formatTierLine(decided)}）` };
  return { docsOnly: true, reason: `変えたファイル（${paths.length} 件）はすべて文書（段階 L1）なので、品質コマンドを飛ばします` };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let result;
  try {
    result = decideDocsOnly({
      eventName: process.env.EVENT_NAME,
      baseRef: process.env.BASE_REF,
      git: (args) => spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }),
    });
  } catch (error) {
    result = { docsOnly: false, reason: `判定に失敗したので、すべてのステップを実行します（${error.message}）` };
  }
  console.error(`ci-docs-only: ${result.reason}`);
  const line = `docs_only=${result.docsOnly}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, line);
  else process.stdout.write(line);
}
