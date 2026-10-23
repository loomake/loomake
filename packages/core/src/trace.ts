import { readTable, splitLines, type ParseError, type ParseResult, type TableRow } from './parse.js';

// 表の列名。trace.md の列名をそのままキーにする
export const LEDGER_COLUMNS = ['ID', '出典', '種別', '要約（原文に忠実に）', '状態', '反映先'] as const;
// 回答者・回答日・承認者・承認日は後から足した列。列の無い trace.md では空の文字列になる（add-agreement-columns の仮定 A-10）
export const QUESTION_COLUMNS = ['ID', '関連', '質問', '選択肢', 'おすすめ', 'ブロッキング', '回答', '回答者', '回答日'] as const;
export const ASSUMPTION_COLUMNS = ['ID', '関連', '仮定の内容', '理由', '承認', '承認者', '承認日'] as const;
// 列が無くてもよい列。これ以外の列が無い表は解析エラーにする（fix-review-findings の仮定 A-05）
const OPTIONAL_COLUMNS: readonly string[] = ['回答者', '回答日', '承認者', '承認日'];

/** 表の行。列名をキーにした値と、行番号を持つ */
type Row<C extends readonly string[]> = { [K in C[number]]: string } & { line: number };

export type LedgerRow = Row<typeof LEDGER_COLUMNS>;
export type QuestionRow = Row<typeof QUESTION_COLUMNS>;
export type AssumptionRow = Row<typeof ASSUMPTION_COLUMNS>;

export type Trace = {
  ledger: LedgerRow[];
  questions: QuestionRow[];
  assumptions: AssumptionRow[];
};

/** 要件台帳の「状態」に書いてよい値 */
export const LEDGER_STATES = ['反映済', '確認待ち', '範囲外', '既存仕様で充足'] as const;

const TABLES = [
  { key: 'ledger', heading: '要件台帳', columns: LEDGER_COLUMNS },
  { key: 'questions', heading: '確認事項', columns: QUESTION_COLUMNS },
  { key: 'assumptions', heading: '仮定', columns: ASSUMPTION_COLUMNS },
] as const;

const toRow = <C extends readonly string[]>(columns: C, row: TableRow) =>
  ({ ...Object.fromEntries(columns.map((c) => [c, row.cells[c] ?? ''])), line: row.line }) as Row<C>;

/**
 * trace.md の「要件台帳」「確認事項」「仮定」の表を読む（REQ-011）。
 * 表が無いときと、台帳の状態値が決まった値でないとき（REQ-012）は、エラーとして返す
 */
export function parseTrace(file: string, text: string): ParseResult<Trace> {
  const lines = splitLines(text);
  const errors: ParseError[] = [];
  const value: Trace = { ledger: [], questions: [], assumptions: [] };
  for (const { key, heading, columns } of TABLES) {
    const table = readTable(lines, heading);
    if (table === null) {
      errors.push({ file, line: 1, message: `「## ${heading}」の節がありません` });
      continue;
    }
    if (!table.found) {
      errors.push({ file, line: table.line, message: `「${heading}」の表がありません` });
      continue;
    }
    const header = table.header ?? { names: [], line: table.line };
    const missing = columns.filter((c) => !OPTIONAL_COLUMNS.includes(c) && !header.names.includes(c));
    if (missing.length) {
      errors.push({ file, line: header.line, message: `「${heading}」の表に「${missing.join('」「')}」の列がありません` });
    }
    (value[key] as Row<typeof columns>[]) = table.rows.map((r) => toRow(columns, r));
  }
  for (const row of value.ledger) {
    if (!(LEDGER_STATES as readonly string[]).includes(row['状態'])) {
      errors.push({
        file,
        line: row.line,
        message: `${row.ID} の状態「${row['状態']}」は使えません（${LEDGER_STATES.join('・')} のどれかにしてください）`,
      });
    }
  }
  return { value, errors };
}
