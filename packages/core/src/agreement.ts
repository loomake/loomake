import { LEDGER_STATES, type Trace } from './trace.js';
import type { ParseError, ParseResult } from './parse.js';

declare const requirementIdBrand: unique symbol;
export type RequirementId = string & { readonly [requirementIdBrand]: true };
export type LedgerState = (typeof LEDGER_STATES)[number];

/** 表の書式と切り離した、要件と合意の判定に必要なモデル。 */
export type Agreement = {
  readonly requirements: readonly { readonly id: RequirementId; readonly source: string; readonly state: LedgerState }[];
  readonly questions: readonly { readonly id: string; readonly blocking: boolean; readonly answer: string }[];
  readonly assumptions: readonly { readonly id: string; readonly approval: string }[];
};

/** 解析したtraceを検証してモデルに変換する。不正な行はエラーに残し、モデルへ含めない。 */
export function createAgreement(file: string, trace: Trace): ParseResult<Agreement> {
  const errors: ParseError[] = [];
  const requirements: Agreement['requirements'][number][] = [];
  for (const row of trace.ledger) {
    if (!/^REQ-\d{3,}$/.test(row.ID)) {
      errors.push({ file, line: row.line, message: `要件ID「${row.ID}」はREQと3桁以上の数字にしてください` });
      continue;
    }
    if (!(LEDGER_STATES as readonly string[]).includes(row['状態'])) {
      errors.push({ file, line: row.line, message: `要件「${row.ID}」の状態「${row['状態']}」は使えません` });
      continue;
    }
    requirements.push({ id: row.ID as RequirementId, source: row['出典'], state: row['状態'] as LedgerState });
  }
  return {
    value: {
      requirements,
      questions: trace.questions.map((q) => ({ id: q.ID, blocking: /^yes$/i.test(q['ブロッキング']) || q['ブロッキング'] === 'はい', answer: q['回答'] })),
      assumptions: trace.assumptions.map((a) => ({ id: a.ID, approval: a['承認'] })),
    },
    errors,
  };
}
