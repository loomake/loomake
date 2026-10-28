---
'@loomake/core': patch
---

verify 結果を Zod スキーマ（`verifyResultSchema`・`verifyCheckResultSchema`・`verifyModeSchema`。`loadVerifyResultSchemas()` で読む）で定義し、`VerifyResult`・`VerifyCheckResult`・`VerifyMode` の型をスキーマから導出する。実行時依存に `zod` を足す。`schema/verify-result.schema.json` は Zod スキーマから書き出したものに置き換え、未知のフィールドを許すようにした。`schemaVersion` は 1.0.0 のままで、verify が出す JSON の形は変えない。
