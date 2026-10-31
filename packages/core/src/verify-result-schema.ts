// verify 結果の Zod スキーマ（REQ-016・REQ-274・REQ-311）。いま書き出す版は 2.0.0（verify-result-v2-schema.ts）。
// packages/core/schema/verify-result.schema.json は、このファイルの verifyResultSchema から書き出す（REQ-276）。
// CLI の起動で zod を読まないように、@loomake/core の入口からは loadVerifyResultSchemas() で遅れて読む
import { z } from 'zod';
import { preserveUnknownFields } from './preserve-unknown-fields.js';
import {
  verifyCheckV2Schema, verifyResultV2AbortedSchema, verifyResultV2CiSchema, verifyResultV2LocalSchema,
} from './verify-result-v2-schema.js';

/** 1.0.0 の mode。2.0.0 には mode がなく、履歴の結果を読むときだけ使う */
export const verifyModeSchema = z
  .enum(['quality', 'spec-only', 'done'])
  .describe('quality = 品質コマンドだけ、spec-only = 仕様ゲート、done = 完了ゲート');

/** いまの verify 結果の各検査（2.0.0 の checks の要素） */
export const verifyCheckResultSchema = verifyCheckV2Schema;

/** いま書き出す verify 結果（2.0.0）。版付きでないパスの JSON Schema はこのスキーマから書き出す（REQ-276・REQ-304） */
export const verifyResultSchema = preserveUnknownFields(z
  .union([verifyResultV2CiSchema, verifyResultV2LocalSchema, verifyResultV2AbortedSchema])
  .meta({
    $id: 'https://loomake.dev/schema/verify-result.schema.json',
    title: 'Loomake verify result',
    description: 'verify --json が出力する結果（2.0.0）。scope と実行状態（completed・partial・aborted）の組で形を分ける。破壊的変更を入れるときは schemaVersion のメジャー番号を上げる（REQ-053）',
  }));

// 履歴の 1.0.0 と、要件定義 7.3 の 2.0.0 のスキーマ。loadVerifyResultSchemas() から一緒に読めるようにする
export { legacyVerifyCheckResultSchema, legacyVerifyResultSchema } from './verify-result-legacy-schema.js';
export {
  verifyScopeSchema, verifyRunErrorSchema, verifyCheckV2Schema, verifyDecisionSchema, verifyCiSummarySchema, verifyLocalSummarySchema,
  verifyResultV2CiSchema, verifyResultV2LocalSchema, verifyResultV2AbortedSchema, verifyResultV2Schema,
} from './verify-result-v2-schema.js';
