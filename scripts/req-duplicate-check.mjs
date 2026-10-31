#!/usr/bin/env node
// REQ ID の重複を調べる。主仕様（openspec/specs/<capability>/spec.md）に、進行中の change（openspec/changes/<id>/specs/、archive は除く）の
// 差分仕様を当てた後の Requirement について、Source の REQ ID を集め、同じ ID が 2 つ以上の Requirement に付いていたら一覧を出して失敗する。
// 差分は OpenSpec と同じ順（RENAMED → REMOVED → MODIFIED → ADDED）で当てるので、同じ Requirement を MODIFIED した差分仕様は重複に数えない。
// 意図して 1 つの ID を複数の Requirement で共有しているものは scripts/req-duplicate-known.json に書く。そこにない組み合わせだけを失敗にする。
// gate（scripts/ci-gate.mjs）がどの段階でも呼ぶ。単独でも動く
//
//   node scripts/req-duplicate-check.mjs

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isMain } from './lib/is-main.mjs';

export const KNOWN_PATH = 'scripts/req-duplicate-known.json';
const REQ_ID = /REQ-\d{3,}/g;
// OpenSpec 1.14 と同じく、RENAMED の FROM・TO は箇条書きの記号を省いてよく、名前はバッククォートで囲んでよい（packages/core/src/spec.ts と同じ形）
const FROM = /^\s*[-*+]?\s*FROM:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/;
const TO = /^\s*[-*+]?\s*TO:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/;

/**
 * spec.md から Requirement ごとの操作（主仕様は null）・名前・Source の REQ ID を取り出す。コードブロックの中は読まない。
 * 読み方は packages/core/src/spec.ts の parseSpec にそろえる。行末は CRLF・CR を LF にそろえ、Requirement は次の `### Requirement:` か `## ` の見出しまで続く
 */
export function parseRequirements(text) {
  const items = [];
  let op = null;
  let cur = null;
  let from = null;
  let fence = null;
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const mark = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence !== null) {
      if (mark && mark[1][0] === fence[0] && mark[1].length >= fence.length) fence = null;
      continue;
    }
    if (mark) { fence = mark[1]; continue; }
    if (/^## /.test(line)) {
      const m = line.match(/^## (ADDED|MODIFIED|REMOVED|RENAMED) Requirements\s*$/);
      op = m ? m[1] : null;
      cur = null;
      from = null;
      continue;
    }
    if (op === 'RENAMED') {
      const f = line.match(FROM);
      const t = line.match(TO);
      if (f) from = f[1].trim();
      else if (t && from !== null) { items.push({ op, name: t[1].trim(), from, sources: [] }); from = null; }
      continue;
    }
    const req = line.match(/^### Requirement:\s*(.+?)\s*$/);
    if (req) {
      cur = { op, name: req[1], sources: [] };
      items.push(cur);
      continue;
    }
    const src = cur && line.match(/^\**Source\**:\**\s*(.+)$/);
    if (src) cur.sources.push(...(src[1].match(REQ_ID) ?? []));
  }
  return items;
}

const dirs = (dir) => (existsSync(dir) ? readdirSync(dir).filter((name) => !name.startsWith('.') && statSync(join(dir, name)).isDirectory()).sort() : []);
const specFiles = (specsDir) => dirs(specsDir).map((capability) => ({ capability, file: join(specsDir, capability, 'spec.md') })).filter(({ file }) => existsSync(file));
const keyOf = (capability, name) => `${capability}: ${name}`;

/** 主仕様に進行中の change の差分仕様を当て、Requirement（「capability: 名前」）ごとの REQ ID の集合を返す */
export function collectRequirements(root = '.') {
  const requirements = new Map();
  for (const { capability, file } of specFiles(join(root, 'openspec', 'specs'))) {
    for (const item of parseRequirements(readFileSync(file, 'utf8'))) {
      if (item.op === null) requirements.set(keyOf(capability, item.name), new Set(item.sources));
    }
  }
  // 2 つの change が同じ Requirement を MODIFIED したときは、主仕様の Source を最初の change で置き換え、後の change の分は足す
  const touched = new Set();
  const changesDir = join(root, 'openspec', 'changes');
  for (const change of dirs(changesDir).filter((name) => name !== 'archive')) {
    for (const { capability, file } of specFiles(join(changesDir, change, 'specs'))) {
      const items = parseRequirements(readFileSync(file, 'utf8'));
      for (const op of ['RENAMED', 'REMOVED', 'MODIFIED', 'ADDED']) {
        for (const item of items.filter((entry) => entry.op === op)) {
          const key = keyOf(capability, item.name);
          if (op === 'RENAMED') {
            const before = keyOf(capability, item.from);
            if (requirements.has(before)) { requirements.set(key, requirements.get(before)); requirements.delete(before); }
          } else if (op === 'REMOVED') {
            requirements.delete(key);
          } else {
            const sources = touched.has(key) ? [...(requirements.get(key) ?? []), ...item.sources] : item.sources;
            requirements.set(key, new Set(sources));
            touched.add(key);
          }
        }
      }
    }
  }
  return requirements;
}

/** 2 つ以上の Requirement に付いている REQ ID と、その Requirement の一覧（名前順） */
export function findDuplicates(requirements) {
  const byId = new Map();
  for (const [key, ids] of requirements) for (const id of ids) byId.set(id, [...(byId.get(id) ?? []), key]);
  return [...byId].filter(([, keys]) => keys.length > 1).map(([id, keys]) => ({ id, requirements: keys.sort() })).sort((a, b) => a.id.localeCompare(b.id));
}

/** 既知の共有（KNOWN_PATH）を読む。なければ空。形が違えば理由つきで投げる */
export function readKnown(root = '.') {
  const file = join(root, KNOWN_PATH);
  if (!existsSync(file)) return [];
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`${KNOWN_PATH} を JSON として読めませんでした。構文を直してください`);
  }
  const known = data?.known;
  if (!Array.isArray(known) || !known.every((entry) => typeof entry?.id === 'string' && Array.isArray(entry.requirements) && entry.requirements.every((key) => typeof key === 'string'))) {
    throw new Error(`${KNOWN_PATH} の known は { id, requirements: [...] } の配列にしてください`);
  }
  return known;
}

/** 既知の共有に含まれない重複だけを返す。既知の ID でも、一覧にない Requirement に付いたら重複に数える */
export function unknownDuplicates(duplicates, known) {
  return duplicates.filter(({ id, requirements }) => {
    const allowed = new Set(known.filter((entry) => entry.id === id).flatMap((entry) => entry.requirements));
    return requirements.some((key) => !allowed.has(key));
  });
}

/** 既知の一覧のうち、今の重複と一致しない項目（重複でなくなった ID か、その ID に今は付いていない Requirement を含むもの） */
export function staleKnown(duplicates, known) {
  return known.filter(({ id, requirements }) => {
    const current = new Set(duplicates.find((entry) => entry.id === id)?.requirements ?? []);
    return requirements.some((key) => !current.has(key));
  });
}

/** 検査の結果。problems が空なら合格。stale は警告だけで、失敗にはしない */
export function checkReqDuplicates(root = '.') {
  const duplicates = findDuplicates(collectRequirements(root));
  const known = readKnown(root);
  return { duplicates, problems: unknownDuplicates(duplicates, known), stale: staleKnown(duplicates, known) };
}

/** 一覧と合わなくなった既知の項目の警告。直したか名前を変えたなら、一覧から消すか直す */
export function formatStale(stale) {
  return [
    `REQ ID の重複（警告）：${KNOWN_PATH} の ${stale.length} 件が今の重複と一致しません。重複を直したなら一覧から消し、Requirement の名前を変えたなら一覧も直してください`,
    ...stale.map(({ id, requirements }) => `  ${id}：${requirements.join(' ／ ')}`),
  ].join('\n');
}

export function formatProblems(problems) {
  return [
    `REQ ID の重複：同じ REQ ID が 2 つ以上の Requirement の Source に付いています（${problems.length} 件）。別の要件なら ID を振り直し、意図して共有するなら ${KNOWN_PATH} に足してください`,
    ...problems.map(({ id, requirements }) => `  ${id}：${requirements.join(' ／ ')}`),
  ].join('\n');
}

if (isMain(import.meta.url)) {
  try {
    const { duplicates, problems, stale } = checkReqDuplicates();
    if (stale.length) console.error(formatStale(stale));
    if (problems.length) {
      console.error(formatProblems(problems));
      process.exitCode = 1;
    } else {
      console.error(`REQ ID の重複：なし（既知の共有 ${duplicates.length} 件は ${KNOWN_PATH} のとおり）`);
    }
  } catch (error) {
    console.error(`REQ ID の重複を調べられませんでした：${error.message}`);
    process.exitCode = 1;
  }
}
