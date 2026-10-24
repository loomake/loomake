import { readTable, splitLines } from './parse.js';

/** 書き換える表。確認事項か仮定 */
export type EditableTable = 'questions' | 'assumptions';

const HEADINGS: Record<EditableTable, string> = { questions: '確認事項', assumptions: '仮定' };

/** text は書き換えたあとの trace.md。error があれば書き換えていない。missingColumns は表になく書かなかった列 */
export type TraceEditResult = { text?: string; error?: string; missingColumns: string[] };

// セルの区切りと同じ規則で行を分ける。\| は区切りではない
const splitRow = (row: string) =>
  row
    .trim()
    .replace(/^\||(?<!\\)\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());

/**
 * trace.md の確認事項か仮定の表で、ID の行の列に値を書く（REQ-202・REQ-203）。ファイルは読まない。
 * 値がすでにある列には書かない。表にない列は書かずに missingColumns で返す。表のほかの行と表の外は変えない
 */
export function setTraceCells(text: string, table: EditableTable, id: string, values: Record<string, string>): TraceEditResult {
  const heading = HEADINGS[table];
  for (const [column, value] of Object.entries(values)) {
    if (/[\r\n]/.test(value)) return { error: `${column} の値に改行は使えません`, missingColumns: [] };
  }
  const lines = splitLines(text);
  const parsed = readTable(lines, heading);
  if (!parsed?.found || !parsed.header) return { error: `「## ${heading}」の表がありません`, missingColumns: [] };
  const row = parsed.rows.find((r) => r.cells.ID === id);
  if (!row) return { error: `「${heading}」の表に ${id} の行がありません`, missingColumns: [] };
  const names = parsed.header.names;
  const filled = Object.keys(values).filter((c) => names.includes(c) && (row.cells[c] ?? '') !== '');
  if (filled.length) return { error: `${id} の ${filled.join('・')} にはすでに値があります。直すときは trace.md を編集してください`, missingColumns: [] };

  const cells = splitRow(lines[row.line - 1]);
  while (cells.length < names.length) cells.push('');
  for (const [column, value] of Object.entries(values)) {
    const i = names.indexOf(column);
    if (i >= 0) cells[i] = value.replace(/\|/g, '\\|');
  }
  lines[row.line - 1] = `| ${cells.join(' | ')} |`;
  // 元の改行コードにそろえる
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return { text: lines.join(eol), missingColumns: Object.keys(values).filter((c) => !names.includes(c)) };
}
