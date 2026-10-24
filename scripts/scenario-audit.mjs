import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  for (const [index, start] of headings.entries()) {
    const heading = lines[start].match(/^### Requirement:\s*(.+?)\s*$/);
    if (!heading) continue;
    const end = headings[index + 1] ?? lines.length;
    while (cursor < scenarioHeadings.length && scenarioHeadings[cursor] <= start) cursor++;
    const first = cursor;
    while (cursor < scenarioHeadings.length && scenarioHeadings[cursor] < end) cursor++;
    const starts = scenarioHeadings.slice(first, cursor);
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
  required(rows.length === scenarioHeadings.length, `Requirementに属さないScenarioがあります：${file}`);
  required(rows.length > 0, `Scenarioを読み取れません：${file}`);
  return rows;
}

/** レビューと実行結果を照合する。IDの候補だけでは確認済みにしない。 */
export function auditScenarios(scenarios, reviews, executions, testSources) {
  required(Array.isArray(scenarios) && Array.isArray(reviews) && Array.isArray(executions), 'Scenario・レビュー・実行結果は配列にしてください');
  const issues = []; const byId = new Map(); const mappings = new Map();
  for (const row of scenarios) { required(!byId.has(row.id), `Scenarioが重複しています：${row.id}`); byId.set(row.id, row); }
  for (const entry of reviews) {
    if (!object(entry) || typeof entry.id !== 'string') { issues.push('レビューの形が不正です'); continue; }
    if (mappings.has(entry.id)) issues.push(`レビューが重複しています：${entry.id}`);
    const entries = mappings.get(entry.id) ?? []; entries.push(entry); mappings.set(entry.id, entries);
    if (!byId.has(entry.id)) issues.push(`存在しないScenarioのレビューです：${entry.id}`);
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
          const selected = []; let error;
          for (const selector of entry.tests) {
            if (!object(selector) || typeof selector.file !== 'string' || typeof selector.contains !== 'string' || !selector.contains.trim()) { error = '試験の選択条件が不正です'; break; }
            if (typeof testSources[selector.file] !== 'string' || sha256(testSources[selector.file]) !== selector.sha256) { error = `試験のソースが変更されたか存在しません：${selector.file}`; break; }
            const found = executions.filter((test) => test.file === selector.file && test.fullName.includes(selector.contains));
            if (!found.length) { error = `実行した試験が見つかりません：${selector.file} ${selector.contains}`; break; }
            if (found.some((test) => test.status !== 'passed')) { error = '選んだ試験に失敗または未実行があります'; break; }
            selected.push(...found);
          }
          if (!error && sources.some((source) => !selected.some((test) => test.fullName.includes(`[${source}]`)))) error = '対応する試験に必要なSourceがありません';
          result = error ? invalid(error) : { status: 'reviewed', reason: entry.reason, reviewSources: sources, tests: selected };
        }
      }
    }
    cache.set(id, result); return result;
  };
  const rows = scenarios.map((row) => ({ ...row, ...check(row.id), candidates: executions.filter((test) => row.sources.some((id) => test.fullName.includes(`[${id}]`))) }));
  const counts = { total: rows.length, reviewed: 0, superseded: 0, unreviewed: 0, invalid: 0 };
  for (const row of rows) counts[row.status]++;
  return { schemaVersion: 1, kind: 'scenario-evidence-audit', ok: rows.length > 0 && counts.unreviewed === 0 && counts.invalid === 0 && issues.length === 0, counts, issues, rows };
}

export function renderAudit(report, prefix = '') {
  const cell = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
  return ['# Scenarioと試験の対応', '', `確認済み ${report.counts.reviewed}、置換 ${report.counts.superseded}、未確認 ${report.counts.unreviewed}、無効 ${report.counts.invalid} / 全${report.counts.total}件`, '',
    'REQ-IDの一致は候補です。対応理由はレビュー上の判断で、試験内容の十分さや外部環境の成功を自動で保証しません。', '',
    ...report.issues.map((issue) => `- ${cell(issue)}`), '', '| 仕様の場所 | Requirement / Scenario | 状態 | 理由と対応試験 |', '|---|---|---|---|',
    ...report.rows.map((row) => `| [${cell(row.file)}:${row.line}](${prefix}${row.file}#L${row.line}) | ${cell(row.requirement)} / ${cell(row.scenario)} | ${row.status} | ${cell(row.reason)}<br>${row.tests.length ? row.tests.map((test) => cell(test.file + ': ' + test.fullName)).join('<br>') : `候補 ${row.candidates.length} 件`} |`), '',
  ].join('\n');
}

export async function auditRepository(root, output, reviewFile = 'docs/quality/scenarios.json', reportFile) {
  const { createInputReader, JSON_LIMITS, loadConfig } = await import('../packages/kit/dist/index.js');
  const reader = createInputReader(); const jsonReader = createInputReader(JSON_LIMITS);
  const read = (file) => reader.read(join(root, file));
  const files = reader.walk(join(root, 'openspec/specs')).filter((file) => file.endsWith('/spec.md') || file.endsWith('\\spec.md'));
  for (const item of reader.entries(join(root, 'openspec/changes'))) {
    if (item.name === 'archive' || item.kind !== 'directory') continue;
    files.push(...reader.walk(join(root, 'openspec/changes', item.name, 'specs')).filter((file) => /[/\\]spec\.md$/.test(file)));
  }
  const inventory = files.sort().flatMap((file) => inventoryScenarios(relative(root, file).split('\\').join('/'), reader.read(file)));
  const reportPath = resolve(root, reportFile ?? loadConfig(root).tests.report);
  const reportText = jsonReader.read(reportPath); const input = JSON.parse(reportText);
  required(object(input) && Array.isArray(input.testResults), '試験レポートにtestResultsがありません');
  const executions = input.testResults.flatMap((suite) => {
    required(object(suite) && typeof suite.name === 'string' && Array.isArray(suite.assertionResults), '試験レポートのsuiteが不正です');
    const file = relative(root, resolve(root, suite.name)).split('\\').join('/');
    required(!file.startsWith('../') && !isAbsolute(file), 'リポジトリ外の試験レポートは扱えません');
    return suite.assertionResults.map((test) => ({ file, fullName: test.fullName, status: test.status }));
  });
  const reviewText = existsSync(join(root, reviewFile)) ? jsonReader.read(join(root, reviewFile)) : undefined;
  const review = reviewText ? JSON.parse(reviewText) : { schemaVersion: 1, reviews: [] };
  required(object(review) && review.schemaVersion === 1 && Array.isArray(review.reviews), 'レビュー表の形式かschemaVersionが不正です');
  const sources = Object.fromEntries([...new Set(executions.map((test) => test.file))].map((file) => [file, read(file)]));
  const result = auditScenarios(inventory, review.reviews, executions, sources);
  result.inputs = { specs: Object.fromEntries(files.map((file) => [relative(root, file).split('\\').join('/'), sha256(reader.read(file))])), testSources: Object.fromEntries(Object.entries(sources).map(([file, text]) => [file, sha256(text)])), testReportSha256: sha256(reportText), reviewSha256: reviewText ? sha256(reviewText) : null, scriptSha256: sha256(read('scripts/scenario-audit.mjs')) };
  mkdirSync(output);
  writeFileSync(join(output, 'audit.json'), JSON.stringify(result, null, 2) + '\n');
  writeFileSync(join(output, 'audit.md'), renderAudit(result, relative(output, root).split('\\').join('/') + '/'));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    required(process.argv[2], '新しい監査結果の保存先を指定してください');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const result = await auditRepository(root, resolve(process.argv[2]), process.argv[3], process.argv[4]);
    console.log(JSON.stringify({ ok: result.ok, counts: result.counts, issues: result.issues }));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) { console.error(`Scenarioの監査に失敗しました：${error.message}`); process.exitCode = 1; }
}
