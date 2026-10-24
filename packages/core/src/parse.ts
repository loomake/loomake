// パーサが共通で使う型と、Markdown の読み方

/** 解析エラー。file は呼び出し側が渡したファイル名、line は 1 始まりの行番号 */
export type ParseError = { file: string; line: number; message: string };

export type ParseResult<T> = { value: T; errors: ParseError[] };

/** 要件 ID の形式（`REQ-` と 3 桁以上の数字） */
export const REQ_ID = /REQ-\d{3,}/g;

/** 行末の CRLF・CR を LF にそろえて、行に分ける */
export const splitLines = (text: string): string[] => text.replace(/\r\n?/g, '\n').split('\n');

/** コードブロック（``` か ~~~ で囲んだ範囲）の中の行を true にする */
export function fenceMask(lines: string[]): boolean[] {
  let fence: string | null = null;
  return lines.map((line) => {
    const m = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence === null) {
      if (m) fence = m[1];
      return m !== null;
    }
    if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
    return true;
  });
}

export type TableRow = { cells: Record<string, string>; line: number };
/** line は見出しの行番号。found は節に表（ヘッダと区切り行）があったか。header は表のヘッダの列名と行番号 */
export type Table = { line: number; found: boolean; rows: TableRow[]; header?: { names: string[]; line: number } };

/**
 * `## <heading>` の節にある最初の表を読む。見出しが無ければ null を返す。
 * GFM と同じく、\| はセルの区切りではなく文字の | として読む
 */
export function readTable(lines: string[], heading: string): Table | null {
  const fenced = fenceMask(lines);
  const start = lines.findIndex((l, i) => !fenced[i] && l.trim() === `## ${heading}`);
  if (start < 0) return null;
  const cells = (row: string) =>
    row
      .trim()
      .replace(/^\||(?<!\\)\|$/g, '')
      .split(/(?<!\\)\|/)
      .map((c) => c.trim().replace(/\\\|/g, '|'));
  const tableLines: { text: string; line: number }[] = [];
  for (let i = start + 1; i < lines.length && !(/^## /.test(lines[i]) && !fenced[i]); i++) {
    if (fenced[i]) continue;
    const t = lines[i].trim();
    if (t.startsWith('|')) tableLines.push({ text: t, line: i + 1 });
    else if (tableLines.length > 0 && t !== '') break; // 最初の表が終わった
  }
  if (tableLines.length < 2) return { line: start + 1, found: false, rows: [] };
  const header = cells(tableLines[0].text);
  const rows = tableLines
    .slice(2) // ヘッダと区切り行を飛ばす
    .map(({ text, line }) => ({ values: cells(text), line }))
    .filter(({ values }) => values.some((c) => c !== ''))
    .map(({ values, line }) => ({ cells: Object.fromEntries(header.map((h, i) => [h, values[i] ?? ''])), line }));
  return { line: start + 1, found: true, rows, header: { names: header, line: tableLines[0].line } };
}
