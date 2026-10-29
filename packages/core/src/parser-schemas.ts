// Markdown パーサの value の構造（REQ-298）。意味検証は既存のパーサが行う。
// 公開入口は loadParserSchemas() で遅延ロードし、起動時には zod を読まない。
import { z } from 'zod';
import { ASSUMPTION_COLUMNS, LEDGER_COLUMNS, QUESTION_COLUMNS } from './trace.js';

function stringColumns<C extends readonly string[]>(columns: C) {
  return Object.fromEntries(columns.map((column) => [column, z.string()])) as { [K in C[number]]: z.ZodString };
}

// 状態・日付などは元の文字列を保ち、パーサが不正値も位置情報つきで報告できるようにする。
export const ledgerRowSchema = z.looseObject({ ...stringColumns(LEDGER_COLUMNS), line: z.number() });
export const questionRowSchema = z.looseObject({ ...stringColumns(QUESTION_COLUMNS), line: z.number() });
export const assumptionRowSchema = z.looseObject({ ...stringColumns(ASSUMPTION_COLUMNS), line: z.number() });
export const traceSchema = z
  .looseObject({ ledger: z.array(ledgerRowSchema), questions: z.array(questionRowSchema), assumptions: z.array(assumptionRowSchema) })
  .meta({ $id: 'https://loomake.dev/schema/trace.schema.json', title: 'Loomake parsed trace' });

export const specOperationSchema = z.enum(['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED']);
export const specRequirementSchema = z.looseObject({
  op: specOperationSchema.nullable(),
  name: z.string(),
  from: z.string().optional(),
  sources: z.array(z.string()),
  scenarios: z.number(),
  line: z.number(),
});
export const specSchema = z.array(specRequirementSchema).meta({ $id: 'https://loomake.dev/schema/spec.schema.json', title: 'Loomake parsed spec' });

export const taskSchema = z.looseObject({ checked: z.boolean(), text: z.string(), line: z.number() });
export const tasksSchema = z.array(taskSchema).meta({ $id: 'https://loomake.dev/schema/tasks.schema.json', title: 'Loomake parsed tasks' });
