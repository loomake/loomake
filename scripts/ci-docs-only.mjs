#!/usr/bin/env node
// CI の quality ジョブで、PR で変えたファイルがすべて文書かを判定する（REQ-270）。
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

/**
 * 文書として扱うファイルか。ここに挙げたものだけを文書とし、ほかはすべて quality の対象に残す
 * （設定・実行用のファイル・tests/ の下・packages/ の下は、拡張子が .md でも文書ではない）
 * @param {string} path リポジトリの根からの、/ で区切ったパス
 */
export function isDocumentPath(path) {
  if (typeof path !== 'string' || !path || path.includes('\\')) return false;
  const parts = path.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) return false;
  // Windows で checkout できない名前は、文書の置き場所にあっても文書として扱わない（REQ-281）。
  // git の出力を UTF-8 として読むと、正しくないバイトは U+FFFD になる
  if (/[<>:"|?*�]/.test(path) || [...path].some((char) => char.charCodeAt(0) < 0x20)) return false;
  if (parts.some((part) => /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part))) return false;
  const markdown = path.endsWith('.md');
  // リポジトリの直下の .md（README.md・CONTRIBUTING.md など）
  if (parts.length === 1) return markdown;
  // docs/ の下の .md
  if (parts[0] === 'docs') return markdown;
  // changeset の本文（.changeset/ の直下の .md）。.changeset/config.json などの設定は含めない
  if (parts[0] === '.changeset') return parts.length === 2 && markdown;
  // 仕様と change の成果物（archive/ を含む）。change の spec-gate.txt も含める
  if (parts[0] === 'openspec' && parts[1] === 'specs') return markdown;
  if (parts[0] === 'openspec' && parts[1] === 'changes') return markdown || parts[parts.length - 1] === 'spec-gate.txt';
  return false;
}

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

// 文書として扱うのは通常のファイル（100644）だけ。ファイルがない側（足したファイルの変更前、消したファイルの変更後）は 000000（REQ-282）
const isRegularOrAbsent = (mode) => mode === '100644' || mode === '000000';
const modeNames = { '120000': 'シンボリックリンク', '160000': 'サブモジュール', '100755': '実行できるファイル' };

const list = (paths) => paths.slice(0, 5).join('、') + (paths.length > 5 ? ` ほか ${paths.length - 5} 件` : '');

/**
 * 文書だけの PR かを決める。PR でないとき、差分を取れないとき、差分を解釈できないときは、文書だけとしない
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
  const paths = entries.flatMap((entry) => entry.paths);
  const others = [...new Set(paths.filter((path) => !isDocumentPath(path)))];
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
  return { docsOnly: true, reason: `変えたファイル（${paths.length} 件）はすべて文書なので、品質コマンドを飛ばします` };
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
