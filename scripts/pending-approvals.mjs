// 利用者（オーナー）の判断を待っている項目を集め、配布ワークフロー改善ダッシュボード用の CSV にする。
// 対象は 3 種類：Issue #121 で利用者を呼んだまま返事のないコメント、本文の「## 人の判断が必要な項目」に中身がある開いている PR、
// main の openspec/changes/*/trace.md にある未回答のブロッキングな確認事項。
// 判定は取得済みの JSON と now を受け取る純粋な関数にし、取得（gh・git）は scripts/delivery-metrics.sh と下の CLI が受け持つ。
// 使い方: node scripts/pending-approvals.mjs <Issue #121 のコメントの JSONL> <開いている PR の JSON> <出力 CSV> [ref]
//   trace.md は git の ref（既定 origin/main）から読む。ref は fetch しないので、最新にするのは呼び出し側（delivery-metrics.sh）の役目。未回答の判定は verify と同じく
//   @loomake/core の parseTrace・createAgreement と @loomake/kit の evaluateAgreement の dist を使うので、先に core と kit を build しておく。
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMain } from './lib/is-main.mjs';

// 過去の文書は誤ったハンドル @rrr-xxx を使っていたので、どちらも利用者への呼びかけとして扱う
export const OWNER_MENTION = /(?<![A-Za-z0-9_-])@rrr-(?:www|xxx)(?![A-Za-z0-9_-])/;
// PR のテンプレートの節。中身が「なし」「特になし」で始まるもの（説明が続いてもよい。「- なし」のような箇条書きも含む）と、
// 1 行目が「-」だけのものは、判断待ちがないとみなす。「- npm 公開」のような箇条書きの項目は中身として数える
export const PR_DECISION_HEADING = /^##[ \t]+人の判断が必要な項目[ \t]*$/;
export const PR_NO_DECISION = /^(?:(?:-[ \t]*)?(?:なし|特になし)(?:\s|[（(。]|$)|-[ \t]*(?:\n|$))/;
// Claude は利用者の gh のトークンで直接投稿するので、この目印を本文に付けたコメントは回答とみなさない
export const AGENT_MARKER = '<!-- loomake-agent: claude -->';
export const CSV_HEADER = ['kind', 'source_url', 'title', 'asked_at_jst', 'waiting_hours'];
export const REPO_BLOB = 'https://github.com/loomake/loomake/blob/main';
const TITLE_LENGTH = 60;
const HOUR = 3_600_000;
const JST_OFFSET = 9 * HOUR;

/** 改行を空白にして、先頭の 60 文字（コードポイント単位）を返す */
export function shortTitle(text) {
  return Array.from(String(text ?? '').replace(/\r\n|\r|\n/g, ' ')).slice(0, TITLE_LENGTH).join('');
}

/** ISO 8601 の時刻を日本時間の YYYY-MM-DD HH:MM にする */
export function formatJst(iso) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`時刻として読めません：${iso}`);
  return new Date(ms + JST_OFFSET).toISOString().slice(0, 16).replace('T', ' ');
}

/** asked_at から now までの時間（小数第 1 位まで） */
export function waitingHours(iso, now) {
  return Math.round((now.getTime() - Date.parse(iso)) / HOUR * 10) / 10;
}

/** HTML コメント（<!-- -->）を取り除く。閉じていないコメントは末尾までコメントとみなす */
export function stripHtmlComments(text) {
  return String(text ?? '').replace(/<!--[\s\S]*?(?:-->|$)/g, '');
}

/**
 * Issue #121 のコメント（古い順）から、利用者を呼んだあとに直接の投稿がないものを返す。
 * comments は { login, body, created_at, html_url, via_app } の配列。via_app は REST の performed_via_github_app の slug で、直接の投稿なら null。
 * Codex は GitHub App を通して、Claude は利用者の gh のトークンで投稿するので、どのコメントも投稿者は利用者（rrr-www）になる。
 * そこで投稿者ではなく、App を通さない投稿（ふつうは利用者本人）があとにあるかで回答済みとみなす。呼びかけたコメントの投稿者は問わない。
 * Claude が利用者の gh のトークンで直接投稿したコメントは App を通さないので、本文の AGENT_MARKER で見分けて回答から除く。
 * 既知の制約：目印のない Claude の直接の投稿（目印を付け始める前のものを含む）は、回答として数えてしまう
 */
export function issueRows(comments) {
  const sorted = comments.map((c, index) => ({ c, index })).sort((a, b) => Date.parse(a.c.created_at) - Date.parse(b.c.created_at) || a.index - b.index).map(({ c }) => c);
  return sorted.flatMap((comment, i) => {
    if (!OWNER_MENTION.test(comment.body ?? '')) return [];
    if (sorted.slice(i + 1).some((later) => later.via_app == null && !String(later.body ?? '').includes(AGENT_MARKER))) return [];
    return [{ kind: 'issue121', source_url: comment.html_url, title: shortTitle(comment.body), asked_at: comment.created_at }];
  });
}

/** PR の本文の「## 人の判断が必要な項目」の中身（HTML コメントを除き、前後の空白を落とす）。節がなければ null */
export function decisionSection(body) {
  const lines = stripHtmlComments(body).split(/\r?\n/);
  const start = lines.findIndex((line) => PR_DECISION_HEADING.test(line));
  if (start < 0) return null;
  const end = lines.findIndex((line, i) => i > start && /^##[ \t]/.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}

/** 判断待ちの節に中身がある PR か。空の節と PR_NO_DECISION に当たる節は待ちにしない */
export function needsDecision(body) {
  const section = decisionSection(body);
  return Boolean(section) && !PR_NO_DECISION.test(section);
}

/** 開いている PR（{ number, title, url, body, createdAt }）のうち、判断待ちの節に中身があるもの */
export function prRows(prs) {
  return prs.filter((pr) => needsDecision(pr.body))
    .map((pr) => ({ kind: 'pr', source_url: pr.url, title: shortTitle(`#${pr.number} ${pr.title}`), asked_at: pr.createdAt }));
}

/**
 * verify の仕様ゲートと同じ判定で、trace.md の本文から未回答のブロッキングな確認事項を返す関数を作る。
 * parseTrace・createAgreement は @loomake/core、evaluateAgreement は @loomake/kit のものを渡す
 */
export function blockingFinder({ parseTrace, createAgreement, evaluateAgreement }) {
  return (text) => {
    const trace = parseTrace('trace.md', text).value;
    const open = new Set(evaluateAgreement(createAgreement('trace.md', trace).value).blockingQuestions);
    return trace.questions.filter((q) => open.has(q.ID)).map((q) => ({ id: q.ID, question: q['質問'] }));
  };
}

/** traces は { changeId, text, committedAt } の配列。findBlocking は blockingFinder が返す関数 */
export function traceRows(traces, findBlocking) {
  return traces.flatMap(({ changeId, text, committedAt }) => findBlocking(text).map(({ question }) => ({
    kind: 'trace', source_url: `${REPO_BLOB}/openspec/changes/${changeId}/trace.md`, title: shortTitle(`${changeId}: ${question}`), asked_at: committedAt,
  })));
}

/** 行に日本時間と待ち時間を付け、待ち時間の長い順に並べる */
export function finalizeRows(rows, now) {
  return rows.map((row) => ({ kind: row.kind, source_url: row.source_url, title: row.title, asked_at_jst: formatJst(row.asked_at), waiting_hours: waitingHours(row.asked_at, now) }))
    .sort((a, b) => b.waiting_hours - a.waiting_hours || a.source_url.localeCompare(b.source_url) || a.title.localeCompare(b.title));
}

function csvCell(value) {
  const text = typeof value === 'number' ? value.toFixed(1) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** 見出しと行を CSV の文字列にする。行がなければ見出しだけ */
export function toCsv(rows) {
  return [CSV_HEADER, ...rows.map((row) => CSV_HEADER.map((key) => row[key]))].map((cells) => cells.map(csvCell).join(',')).join('\n') + '\n';
}

/**
 * 3 種類をまとめて CSV にする
 * @param {{ comments?: { body: string, created_at: string, html_url: string, via_app?: string | null }[], prs?: { number: number, title: string, url: string, body: string, createdAt: string }[],
 *   traces?: { changeId: string, text: string, committedAt: string }[], findBlocking?: (text: string) => { id: string, question: string }[], now: Date }} input
 */
export function pendingApprovalsCsv({ comments = [], prs = [], traces = [], findBlocking = () => [], now }) {
  return toCsv(finalizeRows([...issueRows(comments), ...prRows(prs), ...traceRows(traces, findBlocking)], now));
}

function addedAt(git, ref, path) {
  // 消して足し直したファイルは、最も新しく足したコミットを使う。足したコミットが見つからなければ最後のコミットにする
  return git(['log', '--diff-filter=A', '--format=%cI', ref, '--', path]).trim().split('\n')[0] || git(['log', '-1', '--format=%cI', ref, '--', path]).trim();
}

/**
 * ref の openspec/changes/*\/trace.md（archive を除く）を、本文とファイルを足したコミットの時刻とともに読む。
 * 浅い clone では足したコミットが履歴になく、時刻が不正確（履歴の境目のコミットの時刻）になる
 */
export function readTraces(ref, git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })) {
  return git(['ls-tree', '-r', '--name-only', ref, '--', 'openspec/changes']).split('\n')
    .map((path) => /^openspec\/changes\/([^/]+)\/trace\.md$/.exec(path))
    .filter((match) => match && match[1] !== 'archive')
    .map(([path, changeId]) => ({ changeId, text: git(['show', `${ref}:${path}`]), committedAt: addedAt(git, ref, path) }));
}

async function main([commentsFile, prsFile, outFile, ref = 'origin/main']) {
  if (!commentsFile || !prsFile || !outFile) throw new Error('使い方: node scripts/pending-approvals.mjs <コメントの JSONL> <PR の JSON> <出力 CSV> [ref]');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const core = await import(pathToFileURL(join(root, 'packages/core/dist/index.js')).href);
  const kit = await import(pathToFileURL(join(root, 'packages/kit/dist/index.js')).href);
  const comments = readFileSync(commentsFile, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const prs = JSON.parse(readFileSync(prsFile, 'utf8'));
  const csv = pendingApprovalsCsv({ comments, prs, traces: readTraces(ref), findBlocking: blockingFinder({ ...core, ...kit }), now: new Date() });
  writeFileSync(outFile, csv);
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
