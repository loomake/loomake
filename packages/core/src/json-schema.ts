// 外部ツール向けの JSON Schema を Zod スキーマから書き出す（REQ-276・REQ-287）。
// packages/core/schema/ のファイルは、この関数の結果と同じ内容にする
import { z } from 'zod';
import { verifyResultSchema } from './verify-result-schema.js';
import { qualitySchema } from './quality-schema.js';
import { traceSchema, specSchema, tasksSchema } from './parser-schemas.js';
import { evidenceSchema, reportSchema } from './trace-schemas.js';
import { qualityReportSchema } from './quality-report-schema.js';

/** packages/core/schema/ に置くファイル名と、その元になる Zod スキーマ */
export const CONTRACT_SCHEMAS = {
  'verify-result.schema.json': verifyResultSchema,
  'quality.schema.json': qualitySchema,
  'trace.schema.json': traceSchema,
  'spec.schema.json': specSchema,
  'tasks.schema.json': tasksSchema,
  'evidence.schema.json': evidenceSchema,
  'report.schema.json': reportSchema,
  'quality-report.schema.json': qualityReportSchema,
} as const;

/** ファイル名ごとに、書き出す JSON Schema の文字列（2 字下げ、末尾に改行）を返す */
export function renderJsonSchemas(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(CONTRACT_SCHEMAS).map(([file, schema]) => [
      file,
      JSON.stringify(z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' }), null, 2) + '\n',
    ]),
  );
}
