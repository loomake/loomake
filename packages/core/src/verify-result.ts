// verify 結果の版と、Zod スキーマ（verify-result-schema.ts）から導出した型（REQ-016・REQ-274・REQ-308）。
// 型は import type だけで参照するので、このファイルを読んでも zod は読まない
import type { z } from 'zod';
import type {
  legacyVerifyResultSchema, verifyCheckResultSchema, verifyCheckV2Schema, verifyDecisionSchema, verifyModeSchema, verifyResultSchema,
  verifyResultV2AbortedSchema, verifyResultV2CiSchema, verifyResultV2LocalSchema, verifyResultV2Schema, verifyRunErrorSchema, verifyScopeSchema,
} from './verify-result-schema.js';

/** verify 結果のスキーマの版（MAJOR.MINOR.PATCH）。破壊的変更ではメジャー番号を上げる（REQ-053） */
export const VERIFY_RESULT_SCHEMA_VERSION = '1.0.0';
/** 履歴の verify 結果の版。閲覧だけに使う（REQ-274） */
export const LEGACY_VERIFY_RESULT_SCHEMA_VERSION = '1.0.0';
/** 要件定義 7.3 の verify 結果の版（REQ-308） */
export const VERIFY_RESULT_V2_SCHEMA_VERSION = '2.0.0';

export type VerifyMode = z.infer<typeof verifyModeSchema>;
export type VerifyCheckResult = z.infer<typeof verifyCheckResultSchema>;
export type VerifyResult = z.infer<typeof verifyResultSchema>;
export type LegacyVerifyResult = z.infer<typeof legacyVerifyResultSchema>;
export type VerifyScope = z.infer<typeof verifyScopeSchema>;
export type VerifyRunError = z.infer<typeof verifyRunErrorSchema>;
export type VerifyCheckV2 = z.infer<typeof verifyCheckV2Schema>;
export type VerifyDecision = z.infer<typeof verifyDecisionSchema>;
export type VerifyResultV2 = z.infer<typeof verifyResultV2Schema>;
export type VerifyResultV2Ci = z.infer<typeof verifyResultV2CiSchema>;
export type VerifyResultV2Local = z.infer<typeof verifyResultV2LocalSchema>;
export type VerifyResultV2Aborted = z.infer<typeof verifyResultV2AbortedSchema>;

/** verify 結果の Zod スキーマを読む。zod は、解析や検証で使うときに初めて読む */
export const loadVerifyResultSchemas = () => import('./verify-result-schema.js');
