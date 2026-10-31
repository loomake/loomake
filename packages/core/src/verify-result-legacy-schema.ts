// 履歴の verify 結果 1.0.0 の Zod スキーマ（REQ-274）。閲覧に使い、現在の合格判定には使わない。
// packages/core/schema/versions/verify-result-1.0.0.schema.json は、このスキーマから書き出す（REQ-276）。
// 公開した版なので、いまの書き出しの版（verify-result-schema.ts）を変えても、ここは変えない
import { z } from 'zod';
import { LEGACY_VERIFY_RESULT_SCHEMA_VERSION } from './verify-result-versions.js';
import { preserveUnknownFields } from './preserve-unknown-fields.js';

export const legacyVerifyCheckResultSchema = preserveUnknownFields(z.looseObject({
  check: z.string().describe('検査の名前'),
  status: z.enum(['pass', 'fail', 'warn', 'skip']),
  detail: z.string().describe('補足。無いときは空文字列'),
}));

export const legacyVerifyResultSchema = preserveUnknownFields(z
  .looseObject({
    schemaVersion: z.literal(LEGACY_VERIFY_RESULT_SCHEMA_VERSION).describe('このスキーマの版（MAJOR.MINOR.PATCH）'),
    mode: z
      .enum(['quality', 'spec-only', 'done'])
      .describe('quality = 品質コマンドだけ、spec-only = 仕様ゲート、done = 完了ゲート'),
    change: z.string().nullable().describe('検査した change-id。--change を省略したときは null'),
    ok: z.boolean().describe('不合格の検査が 1 つも無いとき true'),
    results: z.array(legacyVerifyCheckResultSchema).describe('検査ごとの結果'),
    coverage: z
      .record(z.string().regex(/^REQ-[0-9]{3,}$/), z.array(z.string()))
      .optional()
      .describe('完了ゲートで、要件 ID ごとのテストファイルの一覧。テストの無い要件は空の配列'),
  })
  .meta({
    $id: 'https://loomake.dev/schema/versions/verify-result-1.0.0.schema.json',
    title: 'Loomake verify result',
    description: 'verify --json が出力する結果。破壊的変更を入れるときは schemaVersion のメジャー番号を上げる（REQ-053）',
  }));
