// verify 結果の 2.0.0 の Zod スキーマ（要件定義 7.3、REQ-308・REQ-309）。
// packages/core/schema/versions/verify-result-2.0.0.schema.json は、このスキーマから書き出す（REQ-276）。
// @loomake/core の入口からは loadVerifyResultSchemas() で遅れて読む
import { z } from 'zod';
import { VERIFY_RESULT_V2_SCHEMA_VERSION } from './verify-result-versions.js';
import { preserveUnknownFields } from './preserve-unknown-fields.js';
import { qualityResultSchema } from './quality-result-schema.js';

const coverageSchema = z
  .record(z.string().regex(/^REQ-[0-9]{3,}$/), z.array(z.string()))
  .optional()
  .describe('完了ゲートで、要件 ID ごとのテストファイルの一覧。テストの無い要件は空の配列');

// 既知の禁止キー。値の型を never にして、キーがあれば拒否する（REQ-275・REQ-308）
const forbidden = z.never().optional();

export const verifyScopeSchema = z.enum(['ci', 'local']).describe('ci = CI 必須項目を含む全条件、local = ローカル実施項目の完了');

export const verifyRunErrorSchema = preserveUnknownFields(z.looseObject({
  kind: z.enum(['usage', 'config', 'permission', 'tool', 'network', 'runtime']).describe('usage・config は終了コード 2、ほかは 3（REQ-309）'),
  target: z.string().describe('対象。change が確定しないときは受け取った入力をそのまま残す'),
  message: z.string().min(1).describe('人向けの日本語の説明'),
  next: z.string().min(1).describe('次に取れる操作'),
}));

export const verifyCheckV2Schema = preserveUnknownFields(z.looseObject({
  id: z.string().min(1).describe('検査の ID（gate:requirements、quality:PQ-001 など）'),
  result: qualityResultSchema,
  reason: z.string().describe('判定の理由'),
  evidence: z.array(z.string()).describe('判定の根拠への参照'),
}));

const count = z.int().nonnegative();

export const verifyDecisionSchema = preserveUnknownFields(z.looseObject({
  required: z.boolean().describe('人の判断が要るとき true。品質判定とは別の軸'),
  reasons: z.array(preserveUnknownFields(z.looseObject({
    code: z.enum(['CRITERIA_RELAXATION', 'PROTECTED_PATH', 'APPROVAL_REQUIRED', 'LIMIT_EXCEEDED']),
    target: z.string(),
    message: z.string(),
  }))),
}));

const summaryShape = { fail: count, insufficient: count, not_applicable: count, evaluated: count.describe('checks の全件数') };
export const verifyCiSummarySchema = preserveUnknownFields(z.looseObject({ ...summaryShape, pending: forbidden }));
export const verifyLocalSummarySchema = preserveUnknownFields(z.looseObject({ ...summaryShape, pending: count.describe('未完了のローカル項目数') }));

const errors = z.array(verifyRunErrorSchema);
const runOf = <S extends z.ZodType, L extends z.ZodType>(status: S, list: L) => preserveUnknownFields(z.looseObject({ status, errors: list }));
const completedRun = runOf(z.literal('completed'), errors.max(0));
const partialRun = runOf(z.literal('partial'), errors.min(1));
const evaluatedRun = z.union([completedRun, partialRun]);
const evaluatedBase = {
  schemaVersion: z.literal(VERIFY_RESULT_V2_SCHEMA_VERSION),
  change: z.string().nullable().describe('検査した change-id。change を指定しない品質専用の実行では null'),
  run: evaluatedRun,
  checks: z.array(verifyCheckV2Schema),
  decision: verifyDecisionSchema,
  coverage: coverageSchema,
};

export const verifyResultV2CiSchema = preserveUnknownFields(z.looseObject({
  ...evaluatedBase,
  scope: z.literal('ci'),
  summary: verifyCiSummarySchema,
  verdict: qualityResultSchema,
}));

export const verifyResultV2LocalSchema = preserveUnknownFields(z.looseObject({
  ...evaluatedBase,
  scope: z.literal('local'),
  summary: verifyLocalSummarySchema,
  verdict: forbidden,
}));

export const verifyResultV2AbortedSchema = preserveUnknownFields(z.looseObject({
  schemaVersion: z.literal(VERIFY_RESULT_V2_SCHEMA_VERSION),
  change: z.string().nullable().describe('change が確定しないときは null'),
  run: runOf(z.literal('aborted'), errors.min(1)),
  scope: forbidden,
  checks: forbidden,
  summary: forbidden,
  decision: forbidden,
  verdict: forbidden,
  coverage: forbidden,
}));

/** 2.0.0 の verify 結果。scope と実行状態の組で形を分ける（REQ-308） */
export const verifyResultV2Schema = preserveUnknownFields(z
  .union([verifyResultV2CiSchema, verifyResultV2LocalSchema, verifyResultV2AbortedSchema])
  .meta({
    $id: 'https://loomake.dev/schema/versions/verify-result-2.0.0.schema.json',
    title: 'Loomake verify result 2.0.0',
    description: 'verify の結果の 2.0.0。scope と実行状態（completed・partial・aborted）の組で形を分ける',
  }));
