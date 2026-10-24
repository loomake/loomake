// verify 結果の型。packages/core/schema/verify-result.schema.json と同じ内容にする（REQ-016）

/** verify 結果のスキーマの版（MAJOR.MINOR.PATCH）。破壊的変更ではメジャー番号を上げる（REQ-053） */
export const VERIFY_RESULT_SCHEMA_VERSION = '1.0.0';

export type VerifyMode = 'quality' | 'spec-only' | 'done';

export type VerifyCheckResult = {
  check: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  /** 補足。無いときは空文字列 */
  detail: string;
};

export type VerifyResult = {
  schemaVersion: typeof VERIFY_RESULT_SCHEMA_VERSION;
  mode: VerifyMode;
  /** --change を省略したときは null */
  change: string | null;
  ok: boolean;
  results: VerifyCheckResult[];
  /** 完了ゲートで、要件 ID ごとのテストファイルの一覧。テストの無い要件は空の配列 */
  coverage?: Record<string, string[]>;
};
