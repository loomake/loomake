// 外部ツール向けの JSON Schema を Zod スキーマから書き出す（REQ-276・REQ-287）。
// packages/core/schema/ のファイルは、この関数の結果と同じ内容にする
import type { z } from 'zod';
import { toInputJsonSchema } from './preserve-unknown-fields.js';
import { legacyVerifyResultSchema, verifyResultSchema, verifyResultV2Schema } from './verify-result-schema.js';
import { qualitySchema } from './quality-schema.js';
import { traceSchema, specSchema, tasksSchema } from './parser-schemas.js';
import { evidenceSchema, evidenceV2Schema, legacyEvidenceSchema, reportSchema } from './trace-schemas.js';
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

/**
 * packages/core/schema/versions/ に置く、版付きのファイル名と元の Zod スキーマ（REQ-276・REQ-304）。
 * 公開した版のファイルは中身を変えない。版付きでない名前のファイルは、いまの書き出しの版を表す
 */
export const VERSIONED_CONTRACT_SCHEMAS = {
  'verify-result-1.0.0.schema.json': legacyVerifyResultSchema,
  'verify-result-2.0.0.schema.json': verifyResultV2Schema,
  'evidence-1.schema.json': legacyEvidenceSchema,
  'evidence-2.schema.json': evidenceV2Schema,
} as const;

const render = (schemas: Record<string, z.ZodType>): Record<string, string> =>
  Object.fromEntries(Object.entries(schemas).map(([file, schema]) => [file, JSON.stringify(toInputJsonSchema(schema), null, 2) + '\n']));

/** ファイル名ごとに、書き出す JSON Schema の文字列（2 字下げ、末尾に改行）を返す */
export function renderJsonSchemas(): Record<string, string> {
  return render(CONTRACT_SCHEMAS);
}

/** versions/ のファイル名ごとに、書き出す JSON Schema の文字列を返す */
export function renderVersionedJsonSchemas(): Record<string, string> {
  return render(VERSIONED_CONTRACT_SCHEMAS);
}
