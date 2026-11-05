// REQ-343：仕様適合の修正を受け付ける機械的な条件。実行証拠と公開契約はレビューで確かめる。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseRequirements } from './req-duplicate-check.mjs';
import { extractTestBlocks } from './scenario-audit.mjs';

const reqId = /^REQ-\d{3,}$/;
const testPath = /^(?:tests\/(?:[^/]+\/)*|packages\/[^/]+\/test\/(?:[^/]+\/)*)[^/]+\.test\.ts$/;

/** PR 本文のすべての経路宣言。行がなければ空配列。 */
export function declaredRoutes(body) {
  return [...body.matchAll(/^[ \t]*loomake-route:[ \t]*(.*?)[ \t]*\r?$/gm)].map((match) => match[1]);
}

/** REQ 宣言は各行をカンマで分け、重複は除く。不正な値を黙って捨てない。 */
export function declaredReqs(body) {
  const values = [...body.matchAll(/^[ \t]*loomake-req:[ \t]*(.*?)[ \t]*\r?$/gm)]
    .flatMap((match) => match[1].split(',').map((value) => value.trim()));
  return { ids: [...new Set(values.filter((value) => reqId.test(value)))], invalid: values.filter((value) => !reqId.test(value)) };
}

// 閉じフェンスに info string がある行を閉じと扱わず、例の Source を主仕様に数えない。
function withoutFences(text) {
  let fence;
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').map((line) => {
    const mark = line.match(/^\s*(`{3,}|~{3,})/);
    if (!fence) {
      if (!mark) return line;
      fence = mark[1];
    } else {
      const close = line.match(/^\s*(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = undefined;
    }
    return '';
  }).join('\n');
}

/** 主仕様の Requirement の Source だけを集める。進行中の delta は読まない。 */
export function mainSpecSourceIds(specsDir) {
  const ids = new Set();
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name === 'spec.md') {
        for (const item of parseRequirements(withoutFences(readFileSync(path, 'utf8')))) {
          if (item.op === null) for (const id of item.sources) ids.add(id);
        }
      }
    }
  };
  if (existsSync(specsDir)) visit(specsDir);
  return ids;
}

/** HEAD の試験呼出を変更前と比べ、名前に含む REQ ID と読取の問題を返す。 */
export function changedTestReqIds(entries, readFile) {
  const ids = new Set();
  const problems = [];
  for (const entry of entries) {
    const path = entry.paths.at(-1);
    if (entry.status === 'D' || !testPath.test(path)) continue;
    let before;
    let after;
    try {
      after = readFile('new', path);
      before = entry.status === 'A' ? '' : readFile('old', entry.paths[0]);
    } catch { /* 読取の例外も不足として返す。 */ }
    if (typeof after !== 'string' || typeof before !== 'string') {
      problems.push(`試験ファイルを読めませんでした：${path}`);
      continue;
    }
    const unchanged = new Set(extractTestBlocks(before).map((block) => block.text));
    for (const block of extractTestBlocks(after)) {
      if (block.end < 0 || !block.pattern || unchanged.has(block.text)) continue;
      const modifiers = block.text.slice(0, block.text.indexOf('('));
      if (/\.\s*(?:skip|todo|skipIf|runIf)\b/.test(modifiers)) continue;
      for (const match of block.pattern.matchAll(/\\\[(REQ-\d{3,})\\\]/g)) ids.add(match[1]);
    }
  }
  return { ids, problems };
}

/** 宣言がなければ従来経路。宣言があれば不足する条件をすべて返す。 */
export function specFixDecision({ body, entries, sourceIds, readFile }) {
  const routes = declaredRoutes(body);
  if (!routes.length) return { route: false };
  const problems = [];
  const invalidRoutes = routes.filter((value) => value.toLowerCase() !== 'spec-fix');
  if (invalidRoutes.length) problems.push(`loomake-route: の値が spec-fix ではありません：${invalidRoutes.map((value) => value || '（空）').join('、')}`);
  const { ids, invalid } = declaredReqs(body);
  if (!ids.length) problems.push('loomake-req: に REQ ID がありません');
  if (invalid.length) problems.push(`loomake-req: の値が REQ ID の形ではありません：${invalid.map((value) => value || '（空）').join('、')}`);
  const specs = [...new Set(entries.flatMap((entry) => entry.paths).filter((path) => path.startsWith('openspec/')))];
  if (specs.length) problems.push(`openspec/ の下のファイルを変えています（${specs.slice(0, 3).join('、')}${specs.length > 3 ? ` ほか ${specs.length - 3} 件` : ''}）`);
  const unknown = ids.filter((id) => !sourceIds.has(id));
  if (unknown.length) problems.push(`主仕様の Requirement の Source にない REQ ID です：${unknown.join('、')}`);
  const tests = changedTestReqIds(entries, readFile);
  problems.push(...tests.problems);
  for (const id of ids.filter((id) => !tests.ids.has(id))) problems.push(`${id} を名前に含むテストの追加・変更が差分にありません`);
  return { route: true, ids, problems };
}
