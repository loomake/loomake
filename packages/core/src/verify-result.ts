// verify 結果の版と、Zod スキーマ（verify-result-schema.ts）から導出した型（REQ-016・REQ-274）。
// 型は import type だけで参照するので、このファイルを読んでも zod は読まない
import type { z } from 'zod';
import type { verifyCheckResultSchema, verifyModeSchema, verifyResultSchema } from './verify-result-schema.js';

/** verify 結果のスキーマの版（MAJOR.MINOR.PATCH）。破壊的変更ではメジャー番号を上げる（REQ-053） */
export const VERIFY_RESULT_SCHEMA_VERSION = '1.0.0';

export type VerifyMode = z.infer<typeof verifyModeSchema>;
export type VerifyCheckResult = z.infer<typeof verifyCheckResultSchema>;
export type VerifyResult = z.infer<typeof verifyResultSchema>;

/** verify 結果の Zod スキーマを読む。zod は、解析や検証で使うときに初めて読む */
export const loadVerifyResultSchemas = () => import('./verify-result-schema.js');
