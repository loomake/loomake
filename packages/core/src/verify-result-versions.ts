// 版付きの verify 結果の版。いまの書き出しの版（verify-result.ts の VERIFY_RESULT_SCHEMA_VERSION）とは別に固定する

/** 履歴の verify 結果の版。閲覧だけに使う（REQ-274） */
export const LEGACY_VERIFY_RESULT_SCHEMA_VERSION = '1.0.0';
/** 要件定義 7.3 の verify 結果の版（REQ-308） */
export const VERIFY_RESULT_V2_SCHEMA_VERSION = '2.0.0';
