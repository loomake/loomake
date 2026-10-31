import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { companionOf, validatePartition } from './lib/test-partition.mjs';

export const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const required = (condition, message) => { if (!condition) throw new Error(message); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** コード例を除き、文書・Requirement・Scenarioで同一性を決める。 */
export function inventoryScenarios(file, text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let fence;
  const masked = lines.map((line) => {
    const match = line.match(/^\s*(`{3,}|~{3,})/);
    if (!fence) { if (match) fence = match[1]; return Boolean(match); }
    if (match && match[1][0] === fence[0] && match[1].length >= fence.length) fence = undefined;
    return true;
  });
  required(!fence, `コードブロックが閉じていません：${file}`);
  const rows = []; const ids = new Set();
  const headings = lines.flatMap((line, i) => !masked[i] && /^#{1,3} /.test(line) ? [i] : []);
  const scenarioHeadings = lines.flatMap((line, i) => !masked[i] && /^#### Scenario:/.test(line) ? [i] : []);
  let cursor = 0;
  let removedSection = false; let removedRequirements = 0; let removedScenarios = 0;
  for (const [index, start] of headings.entries()) {
    if (/^#{1,2} /.test(lines[start])) {
      removedSection = /^## REMOVED Requirements\s*$/.test(lines[start]);
      continue;
    }
    const heading = lines[start].match(/^### Requirement:\s*(.+?)\s*$/);
    if (!heading) continue;
    const end = headings[index + 1] ?? lines.length;
    while (cursor < scenarioHeadings.length && scenarioHeadings[cursor] <= start) cursor++;
    const first = cursor;
    while (cursor < scenarioHeadings.length && scenarioHeadings[cursor] < end) cursor++;
    const starts = scenarioHeadings.slice(first, cursor);
    if (removedSection) {
      removedRequirements++; removedScenarios += starts.length;
      continue;
    }
    required(starts.length > 0, `Scenarioがありません：${file}:${start + 1}`);
    const prefix = lines.slice(start, starts[0]);
    const contract = prefix.join('\n').trim();
    const sources = [...new Set(prefix.filter((line, i) => !masked[start + i] && /^\**Source\**:/.test(line)).flatMap((line) => line.match(/REQ-\d{3,}/g) ?? []))].sort();
    required(sources.length > 0, `Sourceがありません：${file}:${start + 1}`);
    for (const [position, line] of starts.entries()) {
      const name = lines[line].replace(/^#### Scenario:\s*/, '').trim();
      required(name.length > 0, `Scenario名がありません：${file}:${line + 1}`);
      const id = 'SCN-' + sha256(JSON.stringify([file, heading[1], name])).slice(0, 20);
      required(!ids.has(id), `Scenarioの同一性が重複しています：${file}:${line + 1}`); ids.add(id);
      const body = lines.slice(line, starts[position + 1] ?? end).join('\n').trim();
      rows.push({ id, file, requirement: heading[1], scenario: name, sources, line: line + 1, sha256: sha256(contract + '\n' + body), body });
    }
  }
  required(rows.length + removedScenarios === scenarioHeadings.length, `Requirementに属さないScenarioがあります：${file}`);
  required(rows.length > 0 || removedRequirements > 0, `Scenarioを読み取れません：${file}`);
  return rows;
}

const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'in', 'of', 'void', 'delete', 'throw', 'new', 'else', 'do', 'yield', 'await', 'instanceof']);
const CLOSERS = { '(': ')', '[': ']', '{': '}' };

/** 文字列・テンプレート・コメント・正規表現を読み飛ばし、閉じた位置の次を返す。閉じなければ -1。 */
function skipLiteral(text, i) {
  const c = text[i];
  if (c === '/' && text[i + 1] === '/') { const end = text.indexOf('\n', i); return end < 0 ? text.length : end; }
  if (c === '/' && text[i + 1] === '*') { const end = text.indexOf('*/', i + 2); return end < 0 ? -1 : end + 2; }
  if (c === '"' || c === "'") {
    for (let j = i + 1; j < text.length; j++) { if (text[j] === '\\') j++; else if (text[j] === c) return j + 1; else if (text[j] === '\n') return -1; }
    return -1;
  }
  if (c === '`') {
    for (let j = i + 1; j < text.length; j++) {
      if (text[j] === '\\') j++;
      else if (text[j] === '`') return j + 1;
      else if (text[j] === '$' && text[j + 1] === '{') { const end = matchBracket(text, j + 1); if (end < 0) return -1; j = end; }
    }
    return -1;
  }
  if (c === '/') {
    let inClass = false;
    for (let j = i + 1; j < text.length; j++) {
      if (text[j] === '\\') j++;
      else if (text[j] === '\n') return -1;
      else if (text[j] === '[') inClass = true;
      else if (text[j] === ']') inClass = false;
      else if (text[j] === '/' && !inClass) { let k = j + 1; while (/[a-z]/i.test(text[k] ?? '')) k++; return k; }
    }
    return -1;
  }
  return i + 1;
}

/** `/` が正規表現の始まりかを、直前の意味のある字句で決める。 */
function regexAllowed(text, i) {
  let j = i - 1; while (j >= 0 && /\s/.test(text[j])) j--;
  if (j < 0) return true;
  if (/[(,=:[!&|?{};+\-*%<>~^]/.test(text[j])) return true;
  const word = text.slice(Math.max(0, j - 15), j + 1).match(/[A-Za-z_$][\w$]*$/);
  return Boolean(word && KEYWORDS_BEFORE_REGEX.has(word[0]));
}

const literalStart = (text, i) => text[i] === '"' || text[i] === "'" || text[i] === '`' || (text[i] === '/' && (text[i + 1] === '/' || text[i + 1] === '*' || regexAllowed(text, i)));

/** open の位置の括弧に対応する閉じ括弧の位置を返す。不釣り合いや未完なら -1。 */
function matchBracket(text, open) {
  const stack = [CLOSERS[text[open]]];
  for (let i = open + 1; i < text.length;) {
    if (literalStart(text, i)) { const next = skipLiteral(text, i); if (next < 0) return -1; i = next; continue; }
    const c = text[i];
    if (CLOSERS[c]) stack.push(CLOSERS[c]);
    else if (c === ')' || c === ']' || c === '}') { if (stack.pop() !== c) return -1; if (!stack.length) return i; }
    i++;
  }
  return -1;
}

const skipSpace = (text, i) => { while (i < text.length && /\s/.test(text[i])) i++; return i; };

/** 試験名のリテラルを、実行結果の試験名に当てる正規表現の断片へ変える。式と置換は任意の文字列とみなす。 */
function titlePattern(text, start) {
  const quote = text[start]; const end = skipLiteral(text, start);
  if (end < 0) return undefined;
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const unescape = (value) => value.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r?\n|.)/g, (_, code) => {
    if (code[0] === 'u') return String.fromCodePoint(parseInt(code.replace(/[u{}]/g, ''), 16));
    if (code[0] === 'x') return String.fromCharCode(parseInt(code.slice(1), 16));
    return { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' }[code] ?? (/^\r?\n$/.test(code) ? '' : code);
  });
  const parts = [];
  if (quote === '`') {
    let chunk = '';
    for (let i = start + 1; i < end - 1; i++) {
      if (text[i] === '\\') { chunk += text.slice(i, i + 2); i++; }
      else if (text[i] === '$' && text[i + 1] === '{') { parts.push(unescape(chunk), null); chunk = ''; i = matchBracket(text, i + 1); }
      else chunk += text[i];
    }
    parts.push(unescape(chunk));
  } else parts.push(unescape(text.slice(start + 1, end - 1)));
  // 置換と式を除いた固定の文字がない名前（`%s` だけ、`${n}` だけなど）は、どの試験名にも当たるので照合に使わない
  const fixed = parts.some((part) => part !== null && part.replace(/%[sdifjoOc#]|\$[A-Za-z_][\w.]*/g, '').trim() !== '');
  const pattern = parts.map((part) => part === null ? '.*' : part.split(/(%[sdifjoOc#]|%%|\$[A-Za-z_][\w.]*)/).map((piece, index) => index % 2 === 0 ? escape(piece) : piece === '%%' ? '%' : '.*').join('')).join('');
  return { end, pattern: fixed ? pattern : undefined };
}

/** `it(`・`test(` の呼び出しを、修飾と `.each` の表を含めて本文ブロックとして取り出す。 */
export function extractTestBlocks(source) {
  const text = source.replace(/\r\n/g, '\n'); const blocks = [];
  for (let i = 0; i < text.length;) {
    if (literalStart(text, i)) { const next = skipLiteral(text, i); if (next < 0) break; i = next; continue; }
    const word = /[A-Za-z_$]/.test(text[i]) ? text.slice(i, i + 256).match(/^[A-Za-z_$][\w$]*/)[0] : undefined;
    if (word === undefined && /[0-9]/.test(text[i])) { while (/[\w.]/.test(text[i] ?? '')) i++; continue; }
    if (!word) { i++; continue; }
    let back = i - 1; while (back >= 0 && /\s/.test(text[back])) back--;
    if (TEST_FUNCTION.test(word) && text[back] !== '.') blocks.push(readCall(text, i, word.length));
    i += word.length;
  }
  return blocks;
}

/** TypeScript の型引数 `<...>` を読み飛ばす。閉じなければ -1。 */
function skipTypeArguments(text, open) {
  let depth = 0;
  for (let i = open; i < text.length;) {
    if (literalStart(text, i)) { const next = skipLiteral(text, i); if (next < 0) return -1; i = next; continue; }
    const c = text[i];
    if (CLOSERS[c]) { const close = matchBracket(text, i); if (close < 0) return -1; i = close + 1; continue; }
    if (c === '<') depth++;
    else if (c === '>' && text[i - 1] !== '=') { depth--; if (!depth) return i + 1; }
    else if (c === ';' || c === ')') return -1;
    i++;
  }
  return -1;
}

const TEST_FUNCTION = /^(?:it|test|[a-z][\w$]*(?:It|Test))$/;

function readCall(text, start, length) {
  let i = skipSpace(text, start + length); /** @type {{ start: number, end: number, pattern: string | undefined, text: string }} */
  const broken = { start, end: -1, pattern: undefined, text: '' };
  for (;;) {
    if (text[i] === '.') {
      const at = skipSpace(text, i + 1); const name = text.slice(at, at + 64).match(/^[A-Za-z_$][\w$]*/);
      if (!name) return broken;
      i = skipSpace(text, at + name[0].length); continue;
    }
    if (text[i] === '`') { i = skipLiteral(text, i); if (i < 0) return broken; i = skipSpace(text, i); continue; }
    if (text[i] === '<') { i = skipTypeArguments(text, i); if (i < 0) return broken; i = skipSpace(text, i); continue; }
    if (text[i] !== '(') return broken;
    const close = matchBracket(text, i); if (close < 0) return broken;
    const after = skipSpace(text, close + 1);
    if (text[after] === '(' || text[after] === '.') { i = after; continue; }
    const first = skipSpace(text, i + 1); let pattern;
    if (text[first] === '"' || text[first] === "'" || text[first] === '`') {
      const title = titlePattern(text, first);
      if (title && /[,)]/.test(text[skipSpace(text, title.end)] ?? '')) pattern = title.pattern;
    }
    return { start, end: close + 1, pattern, text: text.slice(start, close + 1) };
  }
}

/** 実行した試験ごとに名前の合う本文ブロックを選び、連結したハッシュを返す。特定できなければ undefined。 */
export function blockDigest(source, tests, cache = new Map()) {
  if (typeof source !== 'string') return undefined;
  if (!cache.has(source)) cache.set(source, extractTestBlocks(source));
  const blocks = cache.get(source); const chosen = new Set();
  for (const test of tests) {
    const matched = blocks.filter((block) => block.pattern !== undefined && new RegExp(`(?:^| )${block.pattern}$`, 's').test(test.fullName));
    if (!matched.length || matched.some((block) => block.end < 0)) return undefined;
    for (const block of matched) chosen.add(block);
  }
  if (!chosen.size) return undefined;
  return sha256([...chosen].sort((a, b) => a.start - b.start).map((block) => block.text).join('\n'));
}

/**
 * レビューと実行結果を照合する。IDの候補だけでは確認済みにしない。進行中のchangeのScenarioは未着手として数えるだけにする。
 * @param {any[]} scenarios
 * @param {any[]} reviews
 * @param {any[]} executions
 * @param {Record<string, string>} testSources
 * @param {{ scenarios: { id: string, change: string }[], unreadable: string[] }} [pending]
 */
export function auditScenarios(scenarios, reviews, executions, testSources, pending = { scenarios: [], unreadable: [] }) {
  required(Array.isArray(scenarios) && Array.isArray(reviews) && Array.isArray(executions), 'Scenario・レビュー・実行結果は配列にしてください');
  const issues = []; const byId = new Map(); const mappings = new Map(); const blockCache = new Map();
  const pendingIds = new Set(pending.scenarios.map((row) => row.id));
  for (const row of scenarios) { required(!byId.has(row.id), `Scenarioが重複しています：${row.id}`); byId.set(row.id, row); }
  for (const entry of reviews) {
    if (!object(entry) || typeof entry.id !== 'string') { issues.push('レビューの形が不正です'); continue; }
    if (mappings.has(entry.id)) issues.push(`レビューが重複しています：${entry.id}`);
    const entries = mappings.get(entry.id) ?? []; entries.push(entry); mappings.set(entry.id, entries);
    if (!byId.has(entry.id) && !pendingIds.has(entry.id)) issues.push(`存在しないScenarioのレビューです：${entry.id}`);
  }
  for (const test of executions) required(object(test) && typeof test.file === 'string' && typeof test.fullName === 'string' && typeof test.status === 'string', '試験結果の形が不正です');
  const cache = new Map();
  const check = (id, path = new Set()) => {
    if (path.has(id)) return { status: 'invalid', reason: '置き換えの参照が循環しています', tests: [] };
    if (cache.has(id)) return cache.get(id);
    const row = byId.get(id); const entries = mappings.get(id) ?? [];
    if (!row) return { status: 'invalid', reason: '置き換え先のScenarioがありません', tests: [] };
    let result = { status: 'unreviewed', reason: '対応の内容をレビューしていません', tests: [] };
    if (entries.length > 1) result = { ...result, status: 'invalid', reason: 'レビューが重複しています' };
    else if (entries.length === 1) {
      const entry = entries[0];
      const invalid = (reason) => ({ status: 'invalid', reason, tests: [] });
      if (entry.scenarioSha256 !== row.sha256) result = invalid('ScenarioかRequirementが変更されています');
      else if (entry.status === 'unreviewed') result.reason = entry.reason || result.reason;
      else if (typeof entry.reason !== 'string' || !entry.reason.trim()) result = invalid('対応の理由がありません');
      else if (entry.status === 'superseded') {
        const next = check(entry.replacement, new Set([...path, id]));
        result = ['reviewed', 'superseded'].includes(next.status) ? { status: 'superseded', reason: entry.reason, replacement: entry.replacement, tests: next.tests } : invalid(next.reason);
      } else if (entry.status !== 'reviewed') result = invalid('対応の状態が不正です');
      else {
        const sources = entry.sources;
        if (!Array.isArray(sources) || !sources.length || sources.some((source) => !row.sources.includes(source))) result = invalid('確認するSourceが不正です');
        else if (!Array.isArray(entry.tests) || !entry.tests.length) result = invalid('対応する試験がありません');
        else {
          const selected = new Set(); let error;
          for (const selector of entry.tests) {
            if (!object(selector) || typeof selector.file !== 'string' || typeof selector.contains !== 'string' || !selector.contains.trim()) { error = '試験の選択条件が不正です'; break; }
            if (selector.hashScope !== undefined && selector.hashScope !== 'block') { error = `試験のハッシュの範囲が不正です：${selector.file}`; break; }
            if (typeof testSources[selector.file] !== 'string') { error = `試験のソースが変更されたか存在しません：${selector.file}`; break; }
            if (selector.hashScope === undefined && sha256(testSources[selector.file]) !== selector.sha256) { error = `試験のソースが変更されたか存在しません：${selector.file}`; break; }
            const found = executions.filter((test) => test.file === selector.file && test.fullName.includes(selector.contains));
            if (!found.length) { error = `実行した試験が見つかりません：${selector.file} ${selector.contains}`; break; }
            if (selector.hashScope === 'block') {
              const digest = blockDigest(testSources[selector.file], found, blockCache);
              if (digest === undefined) { error = `試験の本文ブロックを特定できません：${selector.file} ${selector.contains}`; break; }
              if (digest !== selector.sha256) { error = `選んだ試験の本文が変更されています：${selector.file} ${selector.contains}`; break; }
            }
            if (found.some((test) => test.status !== 'passed')) { error = '選んだ試験に失敗または未実行があります'; break; }
            for (const test of found) selected.add(test);
          }
          if (!error && sources.some((source) => ![...selected].some((test) => test.fullName.includes(`[${source}]`)))) error = '対応する試験に必要なSourceがありません';
          result = error ? invalid(error) : { status: 'reviewed', reason: entry.reason, reviewSources: sources, tests: [...selected] };
        }
      }
    }
    cache.set(id, result); return result;
  };
  const rows = scenarios.map((row) => ({ ...row, ...check(row.id), candidates: executions.filter((test) => row.sources.some((id) => test.fullName.includes(`[${id}]`))) }));
  const counts = { total: rows.length, reviewed: 0, superseded: 0, unreviewed: 0, invalid: 0 };
  for (const row of rows) counts[row.status]++;
  const byChange = {};
  for (const row of pending.scenarios) byChange[row.change] = (byChange[row.change] ?? 0) + 1;
  return { schemaVersion: 1, kind: 'scenario-evidence-audit', ok: rows.length > 0 && counts.unreviewed === 0 && counts.invalid === 0 && issues.length === 0, counts, pending: { total: pending.scenarios.length, byChange, unreadable: pending.unreadable }, issues, rows };
}

export function renderAudit(report, prefix = '') {
  const cell = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
  const pending = report.pending ?? { total: 0, byChange: {}, unreadable: [] };
  const pendingLines = pending.total || pending.unreadable.length ? [`未着手（進行中のchange。終了コードに含めない）${pending.total}件：${Object.entries(pending.byChange).map(([change, count]) => `${cell(change)} ${count}`).join('、') || 'なし'}`, ...pending.unreadable.map((file) => `- 読めなかった差分仕様：${cell(file)}`), ''] : [];
  return ['# Scenarioと試験の対応', '', `確認済み ${report.counts.reviewed}、置換 ${report.counts.superseded}、未確認 ${report.counts.unreviewed}、無効 ${report.counts.invalid} / 全${report.counts.total}件`, '', ...pendingLines,
    'REQ-IDの一致は候補です。対応理由はレビュー上の判断で、試験内容の十分さや外部環境の成功を自動で保証しません。', '',
    ...report.issues.map((issue) => `- ${cell(issue)}`), '', '| 仕様の場所 | Requirement / Scenario | 状態 | 理由と対応試験 |', '|---|---|---|---|',
    ...report.rows.map((row) => `| [${cell(row.file)}:${row.line}](${prefix}${row.file}#L${row.line}) | ${cell(row.requirement)} / ${cell(row.scenario)} | ${row.status} | ${cell(row.reason)}<br>${row.tests.length ? row.tests.map((test) => cell(test.file + (test.rawFile && test.rawFile !== test.file ? `（${test.rawFile}）` : '') + ': ' + test.fullName)).join('<br>') : `候補 ${row.candidates.length} 件`} |`), '',
  ].join('\n');
}

/**
 * 仕様ファイルを、監査の対象（openspec/specs）と未着手（archive 以外の進行中の change）に分ける。
 * archive の差分仕様は主仕様へ反映済みなので数えない。進行中の change を読めなくても失敗にしない。
 */
export function inventoryRepository(entries) {
  const inventory = [];
  /** @type {{ scenarios: { id: string, change: string }[], unreadable: string[] }} */
  const pending = { scenarios: [], unreadable: [] };
  for (const { file, text } of [...entries].sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0)) {
    if (!/\/spec\.md$/.test(file)) continue;
    if (file.startsWith('openspec/specs/')) { inventory.push(...inventoryScenarios(file, text)); continue; }
    const change = file.match(/^openspec\/changes\/([^/]+)\/specs\//)?.[1];
    if (!change || change === 'archive') continue;
    try { pending.scenarios.push(...inventoryScenarios(file, text).map((row) => ({ id: row.id, change }))); }
    catch { pending.unreadable.push(file); }
  }
  return { inventory, pending };
}

/** 登録済み companion が元ファイルだけを動的に読み込むことを構造で確かめる。 */
export function companionLinks(registry, readText) {
  const links = new Map();
  const unwrap = (node) => {
    while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) node = node.expression;
    return node;
  };
  for (const source of Object.keys(registry.files)) {
    const companion = companionOf(source);
    required(!links.has(companion), `companionの対応が重複しています：${companion}`);
    const text = readText(companion);
    required(extractTestBlocks(text).length === 0, `companionに試験の宣言があります：${companion}`);
    const ast = ts.createSourceFile(companion, text, ts.ScriptTarget.Latest, true);
    const imports = []; const namespaces = new Set(); const testFunctions = new Set();
    let staticTest = false; let declaresTest = false; let unverifiedBinding = false;
    const importedBindings = (node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === 'vitest') {
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
        if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) if (['it', 'test'].includes((item.propertyName ?? item.name).text)) testFunctions.add(item.name.text);
      }
      ts.forEachChild(node, importedBindings);
    };
    importedBindings(ast);
    const namespaceExpression = (node) => {
      const base = unwrap(node);
      return ts.isIdentifier(base) && namespaces.has(base.text);
    };
    const propertyKey = (node) => {
      if (ts.isComputedPropertyName(node)) {
        const value = unwrap(node.expression);
        return ts.isStringLiteralLike(value) || ts.isNumericLiteral(value) ? value.text : undefined;
      }
      return ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node) ? node.text : undefined;
    };
    const testExpression = (node) => {
      node = unwrap(node);
      if (ts.isIdentifier(node)) return testFunctions.has(node.text);
      if (ts.isPropertyAccessExpression(node)) return (namespaceExpression(node.expression) && ['it', 'test'].includes(node.name.text)) || testExpression(node.expression);
      if (ts.isElementAccessExpression(node)) {
        const key = node.argumentExpression && unwrap(node.argumentExpression);
        const keyName = key && (ts.isStringLiteralLike(key) || ts.isNumericLiteral(key)) ? key.text : undefined;
        if (namespaceExpression(node.expression) && keyName === undefined) unverifiedBinding = true;
        return (namespaceExpression(node.expression) && ['it', 'test'].includes(keyName)) || testExpression(node.expression);
      }
      if (ts.isCallExpression(node)) return testExpression(node.expression);
      if (ts.isTaggedTemplateExpression(node)) return testExpression(node.tag);
      return false;
    };
    const bindingNames = (name, namespace, testFunction) => {
      if (!namespace && !testFunction) return;
      if (ts.isIdentifier(name)) {
        if (namespace) namespaces.add(name.text);
        if (testFunction) testFunctions.add(name.text);
      } else if (ts.isObjectBindingPattern(name)) {
        for (const element of name.elements) {
          if (element.dotDotDotToken) { bindingNames(element.name, namespace, testFunction); continue; }
          const keyName = propertyKey(element.propertyName ?? element.name);
          if (namespace && keyName === undefined) unverifiedBinding = true;
          bindingNames(element.name, false, testFunction || (namespace && ['it', 'test'].includes(keyName)));
        }
      } else if (ts.isObjectLiteralExpression(name)) {
        for (const property of name.properties) {
          if (ts.isSpreadAssignment(property)) { bindingNames(unwrap(property.expression), namespace, testFunction); continue; }
          if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) { unverifiedBinding = true; continue; }
          const keyName = propertyKey(property.name);
          if (namespace && keyName === undefined) unverifiedBinding = true;
          const target = ts.isPropertyAssignment(property) ? unwrap(property.initializer) : property.name;
          bindingNames(target, false, testFunction || (namespace && ['it', 'test'].includes(keyName)));
        }
      } else {
        unverifiedBinding = true;
      }
    };
    const collectBindings = (node) => {
      if (ts.isVariableDeclaration(node) && node.initializer) bindingNames(node.name, namespaceExpression(node.initializer), testExpression(node.initializer));
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) bindingNames(unwrap(node.left), namespaceExpression(node.right), testExpression(node.right));
      ts.forEachChild(node, collectBindings);
    };
    // 関数本体の参照が別名の宣言より前に現れても、束縛を集めてから呼出しを検査する。
    let previousBindings;
    do {
      previousBindings = namespaces.size + testFunctions.size;
      collectBindings(ast);
    } while (previousBindings !== namespaces.size + testFunctions.size);
    const visit = (node) => {
      if (ts.isCallExpression(node) && testExpression(node.expression)) declaresTest = true;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) imports.push(node);
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && /\.test\.[jt]s$/.test(node.moduleSpecifier.text)) staticTest = true;
      ts.forEachChild(node, visit);
    };
    visit(ast);
    required(!unverifiedBinding, `companionの試験関数の束縛を静的に確認できません：${companion}`);
    required(!declaresTest, `companionに試験の宣言があります：${companion}`);
    const expected = './' + basename(source).replace(/\.ts$/, '.js');
    required(ast.parseDiagnostics.length === 0 && !staticTest && imports.length === 1 && imports[0].arguments.length === 1 && ts.isStringLiteral(imports[0].arguments[0]) && imports[0].arguments[0].text === expected, `companionが元ファイルだけを読み込んでいません：${companion}`);
    // 既存の拒否順序と文言を保ったあとで、Vitest の値を扱える構文を閉じる。
    const allowedNames = new Set(['expect']);
    const bindingError = `companionの試験関数の束縛を静的に確認できません：${companion}`;
    const allowedDestructure = (node) => {
      node = unwrap(node);
      if (ts.isObjectBindingPattern(node)) return node.elements.every((element) => !element.dotDotDotToken && allowedNames.has(propertyKey(element.propertyName ?? element.name)));
      if (ts.isObjectLiteralExpression(node)) return node.properties.every((property) =>
        (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && allowedNames.has(propertyKey(property.name)));
      return false;
    };
    const typePosition = (node) => {
      for (let current = node.parent; current; current = current.parent) if (ts.isTypeNode(current)) return true;
      return false;
    };
    const namespacePosition = (node) => {
      if (typePosition(node)) return true;
      let expression = node;
      while (expression.parent && (ts.isParenthesizedExpression(expression.parent) || ts.isAsExpression(expression.parent) || ts.isSatisfiesExpression(expression.parent) || ts.isNonNullExpression(expression.parent)) && expression.parent.expression === expression) expression = expression.parent;
      const parent = expression.parent;
      if (ts.isNamespaceImport(parent) && parent.name === expression) return true;
      if (ts.isPropertyAccessExpression(parent)) return parent.name === expression || (parent.expression === expression && allowedNames.has(parent.name.text));
      if (ts.isElementAccessExpression(parent) && parent.expression === expression) {
        const key = parent.argumentExpression && unwrap(parent.argumentExpression);
        return key && ts.isStringLiteralLike(key) && allowedNames.has(key.text);
      }
      if (ts.isVariableDeclaration(parent)) {
        const statement = parent.parent?.parent;
        if (statement && ts.isVariableStatement(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) return false;
        if (ts.isIdentifier(parent.name) && parent.initializer && namespaceExpression(parent.initializer)) return true;
        return parent.initializer === expression && allowedDestructure(parent.name);
      }
      if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        return parent.right === expression && allowedDestructure(parent.left);
      }
      // プロパティの固定名は namespace の値を参照しない。shorthand は値なので除外しない。
      if ((ts.isPropertyAssignment(parent) || ts.isBindingElement(parent)) && (parent.propertyName ?? parent.name) === expression && !ts.isComputedPropertyName(expression)) return true;
      return false;
    };
    const relativeModule = (text) => /^(?:\.\/|(?:\.\.\/)+)(?:[A-Za-z0-9_-][\w.-]*\/)*[A-Za-z0-9_-][\w.-]*\.(?:js|ts|mjs|mts|cjs|cts|jsx|tsx)$/.test(text) && !/\.(?:test|spec)(?:\.|$)/i.test(text.slice(text.lastIndexOf('/') + 1));
    const readingError = `companionの読み込み先を静的に確認できません：${companion}`;
    const closedSyntax = (node) => {
      required(!(ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) && !(ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require'), readingError);
      let module;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) module = node.moduleSpecifier;
      if (ts.isImportEqualsDeclaration(node)) {
        required(ts.isExternalModuleReference(node.moduleReference), `companionの読み込み先を静的に確認できません：${companion}`);
        module = node.moduleReference.expression;
      }
      if (module) {
        required(ts.isStringLiteral(module) && (module.text === 'vitest' || relativeModule(module.text)), readingError);
        if (module.text === 'vitest' && (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node))) {
          required(ts.isImportDeclaration(node) && !node.importClause?.name, bindingError);
          const bindings = node.importClause?.namedBindings;
          required(bindings && (ts.isNamespaceImport(bindings) || (ts.isNamedImports(bindings) && bindings.elements.every((item) => allowedNames.has((item.propertyName ?? item.name).text)))), bindingError);
        }
      }
      if (ts.isIdentifier(node) && namespaces.has(node.text)) required(namespacePosition(node), bindingError);
      ts.forEachChild(node, closedSyntax);
    };
    closedSyntax(ast);
    links.set(companion, source);
  }
  return links;
}

function partitionInputs(root, jsonReader, reader) {
  try {
    const text = jsonReader.read(join(root, 'tests/test-partition.json'));
    const registry = validatePartition(JSON.parse(text), { exists: (file) => existsSync(join(root, file)) && statSync(join(root, file)).isFile() });
    /** @type {Record<string, string>} */
    const companions = {};
    const links = companionLinks(registry, (file) => {
      const source = reader.read(join(root, file)); companions[file] = sha256(source); return source;
    });
    return { links, partitionSha256: sha256(text), companions };
  } catch (error) { throw new Error(`試験の分割一覧を読めません：${error.message}`, { cause: error }); }
}

const loadKit = () => import('../packages/kit/dist/index.js');

export async function auditRepository(root, output, reviewFile = 'docs/quality/scenarios.json', reportFile, kit) {
  const { createInputReader, JSON_LIMITS, loadConfig } = kit ?? await loadKit();
  const reader = createInputReader(); const jsonReader = createInputReader(JSON_LIMITS);
  const partition = partitionInputs(root, jsonReader, reader);
  const read = (file) => reader.read(join(root, file));
  const posix = (file) => relative(root, file).split('\\').join('/');
  const files = reader.walk(join(root, 'openspec/specs')).filter((file) => /[/\\]spec\.md$/.test(file));
  for (const item of existsSync(join(root, 'openspec/changes')) ? reader.entries(join(root, 'openspec/changes')) : []) {
    if (item.name === 'archive' || item.kind !== 'directory' || !existsSync(join(root, 'openspec/changes', item.name, 'specs'))) continue;
    files.push(...reader.walk(join(root, 'openspec/changes', item.name, 'specs')).filter((file) => /[/\\]spec\.md$/.test(file)));
  }
  const texts = new Map(files.map((file) => [posix(file), reader.read(file)]));
  const { inventory, pending } = inventoryRepository([...texts].map(([file, text]) => ({ file, text })));
  const reportPath = resolve(root, reportFile ?? loadConfig(root).tests.report);
  const reportText = jsonReader.read(reportPath); const input = JSON.parse(reportText);
  const executions = readExecutions(root, input, partition.links);
  const reviewText = existsSync(join(root, reviewFile)) ? jsonReader.read(join(root, reviewFile)) : undefined;
  const review = reviewText ? JSON.parse(reviewText) : { schemaVersion: 1, reviews: [] };
  required(object(review) && review.schemaVersion === 1 && Array.isArray(review.reviews), 'レビュー表の形式かschemaVersionが不正です');
  const sources = Object.fromEntries([...new Set(executions.map((test) => test.file))].map((file) => [file, read(file)]));
  const inputs = { partitionSha256: partition.partitionSha256, companions: partition.companions, specs: Object.fromEntries([...texts].sort(([a], [b]) => a < b ? -1 : 1).map(([file, text]) => [file, sha256(text)])), testSources: Object.fromEntries(Object.entries(sources).map(([file, text]) => [file, sha256(text)])), testReportSha256: sha256(reportText), reviewSha256: reviewText ? sha256(reviewText) : null, scriptSha256: sha256(read('scripts/scenario-audit.mjs')) };
  const result = { ...auditScenarios(inventory, review.reviews, executions, sources, pending), inputs };
  mkdirSync(dirname(output), { recursive: true });
  mkdirSync(output);
  writeFileSync(join(output, 'audit.json'), JSON.stringify(result, null, 2) + '\n');
  writeFileSync(join(output, 'audit.md'), renderAudit(result, relative(output, root).split('\\').join('/') + '/'));
  return result;
}

/**
 * 旧形式（hashScope なし）の選択条件を本文ブロックのハッシュへ移す。本文ブロックが記録時から
 * 変わっていないと確かめられたものだけを書き換え、ほかは旧形式のまま理由ごとに数える。
 * history(file, sha256) は記録したハッシュと同じ内容の過去の版を返す（なければ undefined）。
 */
export function migrateReviews(review, executions, testSources, history) {
  required(object(review) && Array.isArray(review.reviews), 'レビュー表の形式が不正です');
  const counts = { migrated: { unchangedFile: 0, sameBlock: 0 }, kept: { notExecuted: 0, missingFile: 0, unextractable: 0, historyNotFound: 0, blockChanged: 0 }, alreadyBlock: 0 };
  const cache = new Map();
  const reviews = review.reviews.map((entry) => {
    if (!object(entry) || !Array.isArray(entry.tests)) return entry;
    return { ...entry, tests: entry.tests.map((selector) => {
      if (!object(selector) || typeof selector.file !== 'string' || typeof selector.contains !== 'string') return selector;
      if (selector.hashScope !== undefined) { counts.alreadyBlock++; return selector; }
      const keep = (reason) => { counts.kept[reason]++; return selector; };
      const found = executions.filter((test) => test.file === selector.file && test.fullName.includes(selector.contains));
      if (!found.length) return keep('notExecuted');
      const current = testSources[selector.file];
      if (typeof current !== 'string') return keep('missingFile');
      const digest = blockDigest(current, found, cache);
      if (digest === undefined) return keep('unextractable');
      const migrate = (reason) => { counts.migrated[reason]++; return { ...selector, sha256: digest, hashScope: 'block' }; };
      if (sha256(current) === selector.sha256) return migrate('unchangedFile');
      const old = history(selector.file, selector.sha256);
      if (typeof old !== 'string') return keep('historyNotFound');
      return blockDigest(old, found, cache) === digest ? migrate('sameBlock') : keep('blockChanged');
    }) };
  });
  return { review: { ...review, reviews }, counts };
}

/** gitの履歴から、指定したハッシュと同じ内容のファイルの版を探す。 */
export function gitHistory(root) {
  const versions = new Map();
  return (file, digest) => {
    if (!versions.has(file)) {
      const found = new Map();
      try {
        const log = execFileSync('git', ['log', '--all', '--no-abbrev', '--raw', '--format=', '--', file], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        const blobs = [...new Set(log.split('\n').flatMap((line) => line.match(/^:\d+ \d+ ([0-9a-f]{40,64}) ([0-9a-f]{40,64}) /)?.slice(1) ?? []))].filter((blob) => !/^0+$/.test(blob));
        if (blobs.length) {
          const output = execFileSync('git', ['cat-file', '--batch'], { cwd: root, input: blobs.join('\n') + '\n', maxBuffer: 1024 * 1024 * 1024 });
          for (let offset = 0; offset < output.length;) {
            const header = output.indexOf(10, offset); const [, type, size] = output.subarray(offset, header).toString().split(' ');
            if (type !== 'blob') { offset = header + 1; continue; }
            const text = output.subarray(header + 1, header + 1 + Number(size)).toString('utf8');
            found.set(sha256(text), text); offset = header + 1 + Number(size) + 1;
          }
        }
      } catch { /* 履歴を読めなければ版がないものとして扱う */ }
      versions.set(file, found);
    }
    return versions.get(file).get(digest);
  };
}

/**
 * @param {string} root
 * @param {{ dryRun?: boolean, reviewFile?: string, reportFile?: string, kit?: any, history?: (file: string, digest: string) => string | undefined }} [options]
 */
export async function migrateRepository(root, { dryRun = false, reviewFile = 'docs/quality/scenarios.json', reportFile, kit, history } = {}) {
  const { createInputReader, JSON_LIMITS, loadConfig } = kit ?? await loadKit();
  const reader = createInputReader(); const jsonReader = createInputReader(JSON_LIMITS);
  const partition = partitionInputs(root, jsonReader, reader);
  const input = JSON.parse(jsonReader.read(resolve(root, reportFile ?? loadConfig(root).tests.report)));
  const executions = readExecutions(root, input, partition.links);
  const review = JSON.parse(jsonReader.read(join(root, reviewFile)));
  required(object(review) && review.schemaVersion === 1 && Array.isArray(review.reviews), 'レビュー表の形式かschemaVersionが不正です');
  const sources = Object.fromEntries([...new Set(executions.map((test) => test.file))].flatMap((file) => existsSync(join(root, file)) ? [[file, reader.read(join(root, file))]] : []));
  const result = migrateReviews(review, executions, sources, history ?? gitHistory(root));
  if (!dryRun) writeFileSync(join(root, reviewFile), JSON.stringify(result.review, null, 2) + '\n');
  return { dryRun, counts: result.counts };
}

function readExecutions(root, input, links = new Map()) {
  required(object(input) && Array.isArray(input.testResults), '試験レポートにtestResultsがありません');
  return input.testResults.flatMap((suite) => {
    required(object(suite) && typeof suite.name === 'string' && Array.isArray(suite.assertionResults), '試験レポートのsuiteが不正です');
    const file = relative(root, resolve(root, suite.name)).split('\\').join('/');
    required(!file.startsWith('../') && !isAbsolute(file), 'リポジトリ外の試験レポートは扱えません');
    return suite.assertionResults.map((test) => ({ file: links.get(file) ?? file, rawFile: file, fullName: test.fullName, status: test.status }));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  try {
    if (args[0] === '--migrate') {
      const dryRun = args[1] === '--dry-run'; const rest = args.slice(dryRun ? 2 : 1);
      const result = await migrateRepository(root, { dryRun, reviewFile: rest[0], reportFile: rest[1] });
      console.log(JSON.stringify(result));
    } else {
      required(args[0] && !args[0].startsWith('--'), '新しい監査結果の保存先を指定してください');
      const result = await auditRepository(root, resolve(args[0]), args[1], args[2]);
      console.log(JSON.stringify({ ok: result.ok, counts: result.counts, pending: { total: result.pending.total, byChange: result.pending.byChange, unreadable: result.pending.unreadable }, issues: result.issues }));
      process.exitCode = result.ok ? 0 : 1;
    }
  } catch (error) { console.error(`Scenarioの監査に失敗しました：${error.message}`); process.exitCode = 1; }
}
