---
"@loomake/kit": minor
"@loomake/trace": minor
"@loomake/runner": minor
"loomake": minor
---

文書を1ファイル1MiB・同じ処理の合計16MiB、JSONを1ファイル64MiB・証拠の合計128MiB、探索を4096項目・深さ32までに制限する。探索中と入力ファイルのリンクを拒否し、組み立てたエンジン指示全体も16MiBまでに制限する。上限を超えた入力では対象と理由を示して止まる。以前は受け付けた過大入力やリンクを使うspecsでは、文書と対象の分け方を見直す必要がある。UsageErrorの既存exportとJSONの版は維持する。
