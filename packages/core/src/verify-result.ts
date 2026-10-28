// verify 結果の Zod スキーマと、そこから導出した型（REQ-016・REQ-273）。
// packages/core/schema/verify-result.schema.json は、このスキーマから書き出す（REQ-275）
import { z } from 'zod';

/** verify 結果のスキーマの版（MAJOR.MINOR.PATCH）。破壊的変更ではメジャー番号を上げる（REQ-053） */
export const VERIFY_RESULT_SCHEMA_VERSION = '1.0.0';

export const verifyModeSchema = z
  .enum(['quality', 'spec-only', 'done'])
  .describe('quality = 品質コマンドだけ、spec-only = 仕様ゲート、done = 完了ゲート');

// 未知のフィールドは拒否せず、解析結果にそのまま残す（REQ-274）
export const verifyCheckResultSchema = z.looseObject({
  check: z.string().describe('検査の名前'),
  status: z.enum(['pass', 'fail', 'warn', 'skip']),
  detail: z.string().describe('補足。無いときは空文字列'),
});

export const verifyResultSchema = z
  .looseObject({
    schemaVersion: z.literal(VERIFY_RESULT_SCHEMA_VERSION).describe('このスキーマの版（MAJOR.MINOR.PATCH）'),
    mode: verifyModeSchema,
    change: z.string().nullable().describe('検査した change-id。--change を省略したときは null'),
    ok: z.boolean().describe('不合格の検査が 1 つも無いとき true'),
    results: z.array(verifyCheckResultSchema).describe('検査ごとの結果'),
    coverage: z
      .record(z.string().regex(/^REQ-[0-9]{3,}$/), z.array(z.string()))
      .optional()
      .describe('完了ゲートで、要件 ID ごとのテストファイルの一覧。テストの無い要件は空の配列'),
  })
  .meta({
    $id: 'https://loomake.dev/schema/verify-result.schema.json',
    title: 'Loomake verify result',
    description: 'verify --json が出力する結果。破壊的変更を入れるときは schemaVersion のメジャー番号を上げる（REQ-053）',
  });

export type VerifyMode = z.infer<typeof verifyModeSchema>;
export type VerifyCheckResult = z.infer<typeof verifyCheckResultSchema>;
export type VerifyResult = z.infer<typeof verifyResultSchema>;
