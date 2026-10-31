#!/usr/bin/env node
// macOS・Windows で時間切れが続く試験ファイルの隔離一覧（tests/quarantine.json）を検査する（REQ-344・REQ-214）。
//
//   node scripts/ci-quarantine.mjs --os <macos-latest|windows-latest>   … quality のシャードで除外するファイルを出す
//   node scripts/ci-quarantine.mjs --matrix [--samples <1〜5>]           … quality-quarantine のジョブの matrix を出す
//
// 結果は GITHUB_OUTPUT（なければ標準出力）に書く。--os は exclude（JSON の配列）と has_entries、
// --matrix は matrix（JSON）と has_entries。一覧の誤り・期限切れは理由を表示して終了コード 2 で終わる。
// Ubuntu のジョブはこの一覧を読まない。日付は日本時間で比べる。LOOMAKE_QUARANTINE_TODAY（YYYY-MM-DD）で上書きできる（試験用）。

import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/is-main.mjs';
import { assertNotPartitioned, loadPartition, PartitionError } from './lib/test-partition.mjs';

export const QUARANTINE_OS = ['macos-latest', 'windows-latest'];
export const MAX_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const FILE_PATTERN = /^(?:tests|packages\/[a-z0-9-]+\/test)\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.test\.ts$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KEYS = new Set(['file', 'tests', 'os', 'issue', 'added', 'expires']);

/** 一覧の誤り。CLI は終了コード 2 で返す。 */
export class QuarantineError extends Error {}

/** 日本時間の今日の日付（YYYY-MM-DD）。 */
export function todayInJapan(now = Date.now()) {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function parseDate(value, label) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) throw new QuarantineError(`${label} は YYYY-MM-DD の形で書いてください：${JSON.stringify(value)}`);
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new QuarantineError(`${label} が日付として読めません：${value}`);
  return time;
}

/**
 * 一覧を検査し、正しいエントリだけを返す。誤りがあれば最初の誤りで QuarantineError を投げる。
 * @param {unknown} data tests/quarantine.json の中身
 * @param {{ today: string; exists: (file: string) => boolean }} options
 */
export function validateQuarantine(data, { today, exists }) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.entries)) throw new QuarantineError('tests/quarantine.json は { "entries": [...] } の形で書いてください');
  const todayTime = parseDate(today, '今日の日付');
  const seen = new Set();
  return data.entries.map((entry, index) => {
    const where = `entries[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new QuarantineError(`${where} はオブジェクトで書いてください`);
    const unknown = Object.keys(entry).filter((key) => !KEYS.has(key));
    if (unknown.length) throw new QuarantineError(`${where} に知らない項目があります：${unknown.join('、')}`);
    const { file, tests = [], os, issue, added, expires } = entry;
    if (typeof file !== 'string' || !FILE_PATTERN.test(file) || file.split('/').includes('..')) throw new QuarantineError(`${where}.file は tests/ か packages/<name>/test/ の下の .test.ts を書いてください：${JSON.stringify(file)}`);
    const label = `${where}（${file}）`;
    if (seen.has(file)) throw new QuarantineError(`${label} が 2 回書かれています。1 つのエントリにまとめてください`);
    seen.add(file);
    if (!exists(file)) throw new QuarantineError(`${label} のファイルがありません`);
    if (!Array.isArray(tests) || !tests.every((name) => typeof name === 'string' && name.length > 0 && name.length <= 300)) throw new QuarantineError(`${label}.tests は試験名の文字列の配列で書いてください（記録用で、外す範囲には使いません）`);
    if (!Array.isArray(os) || os.length === 0) throw new QuarantineError(`${label}.os に macos-latest か windows-latest を 1 つ以上書いてください`);
    for (const name of os) {
      if (name === 'ubuntu-latest') throw new QuarantineError(`${label}.os に ubuntu-latest があります。Ubuntu の試験は隔離できません`);
      if (!QUARANTINE_OS.includes(name)) throw new QuarantineError(`${label}.os の値が対象外です：${JSON.stringify(name)}（macos-latest・windows-latest のどちらか）`);
    }
    if (new Set(os).size !== os.length) throw new QuarantineError(`${label}.os に同じ OS が 2 回あります`);
    if (!Number.isSafeInteger(issue) || issue <= 0) throw new QuarantineError(`${label}.issue に Issue の番号を書いてください`);
    const addedTime = parseDate(added, `${label}.added`);
    const expiresTime = parseDate(expires, `${label}.expires`);
    if (expiresTime < addedTime) throw new QuarantineError(`${label} の期限 ${expires} が追加日 ${added} より前です`);
    if ((expiresTime - addedTime) / DAY_MS > MAX_DAYS) throw new QuarantineError(`${label} の期限 ${expires} は、追加日 ${added} から ${MAX_DAYS} 日以内にしてください`);
    if (todayTime > expiresTime) throw new QuarantineError(`${label} の期限 ${expires} を過ぎました（今日は ${today}、Issue #${issue}）。直して一覧から外すか、Issue に理由を書いて期限を見直してください`);
    return { file, tests, os: [...os], issue, added, expires };
  });
}

/** その OS のシャードから外すファイル。 */
export function excludedFiles(entries, os) {
  if (!QUARANTINE_OS.includes(os)) throw new QuarantineError(`--os には macos-latest か windows-latest を指定してください：${JSON.stringify(os)}（Ubuntu は一覧を読みません）`);
  return entries.filter((entry) => entry.os.includes(os)).map((entry) => entry.file);
}

/** quality-quarantine のジョブの matrix。OS ごとに 1 つのジョブにまとめ、ファイルを空白で区切る。 */
export function quarantineMatrix(entries, samples = 1) {
  if (!Number.isSafeInteger(samples) || samples < 1 || samples > 5) throw new QuarantineError(`--samples は 1〜5 の整数にしてください：${samples}`);
  const include = [];
  for (const os of QUARANTINE_OS) {
    const files = entries.filter((entry) => entry.os.includes(os)).map((entry) => entry.file);
    if (!files.length) continue;
    for (let sample = 1; sample <= samples; sample++) include.push({ os, sample, files: files.join(' ') });
  }
  return { include };
}

/** リポジトリの一覧を読んで検査する。 */
export function loadQuarantine(root, today) {
  const path = join(root, 'tests/quarantine.json');
  let data;
  try { data = JSON.parse(readFileSync(path, 'utf8')); } catch (error) { throw new QuarantineError(`tests/quarantine.json を読めません：${error.message}`); }
  const entries = validateQuarantine(data, { today, exists: (file) => existsSync(join(root, file)) && statSync(join(root, file)).isFile() });
  try { assertNotPartitioned(entries.map((entry) => entry.file), loadPartition(root)); }
  catch (error) {
    if (!(error instanceof PartitionError)) throw error;
    throw new QuarantineError(error.message);
  }
  return entries;
}

function output(lines) {
  const text = lines.map(([key, value]) => `${key}=${value}\n`).join('');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, text);
  else process.stdout.write(text);
}

/** CLI の本体。終了コードを返す。 */
export function main(argv, root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  try {
    const today = process.env.LOOMAKE_QUARANTINE_TODAY || todayInJapan();
    const [mode, value, extra, samples] = argv;
    if (mode === '--os' && value && extra === undefined) {
      const files = excludedFiles(loadQuarantine(root, today), value);
      for (const file of files) console.error(`ci-quarantine: ${value} のシャードから外す：${file}`);
      output([['exclude', JSON.stringify(files)], ['has_entries', String(files.length > 0)]]);
      return 0;
    }
    if (mode === '--matrix' && (value === undefined || (value === '--samples' && samples === undefined && extra !== undefined))) {
      const entries = loadQuarantine(root, today);
      const matrix = quarantineMatrix(entries, value ? Number(extra) : 1);
      output([['matrix', JSON.stringify(matrix)], ['has_entries', String(matrix.include.length > 0)]]);
      return 0;
    }
    throw new QuarantineError('使い方：node scripts/ci-quarantine.mjs --os <macos-latest|windows-latest> または --matrix [--samples <1〜5>]');
  } catch (error) {
    if (!(error instanceof QuarantineError)) throw error;
    console.error(`ci-quarantine: ${error.message}`);
    return 2;
  }
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
