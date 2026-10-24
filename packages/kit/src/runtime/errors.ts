/** 使い方や設定の誤り。CLI は終了コード2で終える。 */
export class UsageError extends Error {}

/** 外部操作の時間切れ・出力超過・中断などの、実行時の失敗。CLI は終了コード3で終える（REQ-192）。 */
export class RuntimeFailure extends Error {}
