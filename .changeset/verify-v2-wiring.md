---
"@loomake/core": minor
"@loomake/kit": minor
"@loomake/trace": minor
"loomake": minor
"@loomake/runner": patch
---

verify の書き出しを 2.0.0、証拠の記録を Evidence 2 へ切り替える（破壊的変更）。1.0.0 と Evidence 1 は履歴として読めるが、自動の再利用や合格の根拠には使わない。

- `@loomake/core`：`VerifyResult`・`verifyResultSchema`・`VERIFY_RESULT_SCHEMA_VERSION`（2.0.0）と `Evidence`・`evidenceSchema`・`EVIDENCE_SCHEMA_VERSION`（2）が現行の版を表す。`schema/verify-result.schema.json`・`schema/evidence.schema.json` も現行の版になる。1.0.0 と Evidence 1 は `LegacyVerifyResult`・`LegacyEvidence` と `schema/versions/` の版付きのファイルで読む
- `@loomake/kit`：`runVerify` は 2.0.0 を返し、`scope`（ci・local）を受け取る。省略すると完了ゲートは ci、仕様ゲートと change なしの実行は local。`--skip-commands` では前回のテストのレポートを使わず、品質コマンドと要件ごとのテストを不足にする。結果の組み立て `assembleVerifyResult` と、例外を aborted にする `verifyAbortedResult` を足す
- `@loomake/trace`：`runRecord` は `scope`（省略時 ci）を受け取り、Evidence 2 で記録して verify と同じ終了コードを返す。`trace report` は Evidence 1 と Evidence 2 を読み、Evidence 1 には履歴閲覧専用の警告を付ける
- `loomake`：`verify --json` は 2.0.0 を出す。終了コードは 0（ci の PASS、または local の完了）・1（不合格・不足・要判断）・2（使い方と設定の誤り）・3（実行時の失敗）。`--json` を付けると、使い方と設定の誤りも aborted の JSON を標準出力に出す
- `@loomake/runner`：完了ゲートと証拠の記録を scope:local で行い、要判断と aborted では直しに進まず止まる。`RunSummary` の外形は変えない。`lastVerify.ok` はローカルの項目の完了だけを表す
