import { fenceMask, splitLines } from '@loomake/core';
import { CHANGE_ID } from './config.js';

type Declaration = {
  id: string; related: string[]; kind: string; target: string; provider: string;
  expectedBlob: string; ci: string[]; line: number;
};
type DeclarationError = { file: string; line: number; id?: string; message: string };
const columns = ['ID', '関連', '種類', '依存先', '提供元', '期待blob', 'CI'];
const cells = (row: string) => row.trim().replace(/^\||(?<!\\)\|$/g, '').split(/(?<!\\)\|/)
  .map((cell) => cell.trim().replace(/\\\|/g, '|'));

export function readDependencies(text: string, requirementIds: readonly string[], self: string) {
  const lines = splitLines(text), fenced = fenceMask(lines);
  const start = lines.findIndex((line, i) => !fenced[i] && line.trim() === '## 依存する成果物');
  const declarations: Declaration[] = [], errors: DeclarationError[] = [];
  const result = { present: start >= 0, declarations, errors };
  if (start < 0) return result;
  const fail = (line: number, message: string, id?: string) => errors.push({ file: 'trace.md', line, id, message });
  const table: { values: string[]; line: number }[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (fenced[i]) continue;
    if (/^## /.test(lines[i])) break;
    const value = lines[i].trim();
    if (value.startsWith('|')) table.push({ values: cells(value), line: i + 1 });
    else if (table.length && value) break;
  }
  if (table.length < 2) {
    fail(start + 1, '依存する成果物の表がありません');
    return result;
  }
  if (table[0].values.length !== columns.length || table[0].values.some((value, i) => value !== columns[i]) ||
      table[1].values.length !== columns.length || table[1].values.some((value) => !/^:?-+:?$/.test(value))) {
    fail(table[0].line, '列名・順序・列数または区切り行が不正です');
    return result;
  }
  if (table.length === 2) fail(start + 1, '依存する成果物のデータ行がありません');
  const ids = new Set<string>(), known = new Set(requirementIds);
  const validChange = (value: string) => CHANGE_ID.test(value) && value !== 'archive' && value !== self;
  for (const { values, line } of table.slice(2)) {
    const [id, related, kind, target, provider, expectedBlob, ci] = values;
    if (values.length !== columns.length) {
      fail(line, '列数が不正です', id || undefined);
      continue;
    }
    const invalid = (condition: boolean, message: string) => { if (condition) fail(line, message, id || undefined); };
    const relatedIds = related.split(',').map((value) => value.trim());
    const ciIds = ci ? ci.split(',').map((value) => value.trim()) : [];
    invalid(!/^D-\d{2,}$/.test(id) || ids.has(id), 'IDの形または重複が不正です');
    ids.add(id);
    invalid(relatedIds.some((value) => !value || !known.has(value)), '関連は台帳内の要件IDを指定してください');
    invalid(!['change', 'issue', 'path'].includes(kind), '種類はchange・issue・pathを指定してください');
    invalid(ciIds.some((value) => !/^\d+\/\d+$/.test(value)), 'CIはrun/jobの数字を指定してください');
    invalid(Boolean(provider) && !validChange(provider), '提供元のchange-idが不正です');
    if (kind === 'change') {
      invalid(!validChange(target), '依存先のchange-idが不正です');
      invalid(Boolean(provider) && provider !== target, '提供元は依存先と同じchangeを指定してください');
    }
    if (kind === 'issue' || kind === 'path') invalid(!provider, '提供元のchange-idが必要です');
    if (kind === 'issue') invalid(!/^#\d+$/.test(target), '依存先は同じリポジトリのIssue番号を指定してください');
    if (kind === 'path') {
      invalid(target.startsWith('/') || target.includes('\\') || target.split('/').some((part) => !part || part === '..'), '依存先はPOSIX相対パスを指定してください');
      invalid(!/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(expectedBlob), '期待blobは40桁または64桁の16進数を指定してください');
    } else invalid(Boolean(expectedBlob), '期待blobはpathの場合だけ指定してください');
    declarations.push({ id, related: relatedIds, kind, target, provider, expectedBlob, ci: ciIds, line });
  }
  return result;
}
