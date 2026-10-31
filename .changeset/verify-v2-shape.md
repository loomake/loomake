---
"@loomake/core": minor
"@loomake/kit": minor
"@loomake/trace": patch
---

verify 2.0.0 の契約の形を、追加だけで公開する。書き出しは 1.0.0 と Evidence 1 のままで、既存の名前・JSON Schema・CLI の振る舞いは変えない。

- `@loomake/core`：verify 2.0.0 の Zod スキーマと型（`VerifyResultV2` など）、履歴の `LegacyVerifyResult`・`LegacyEvidence`、Evidence 2 の `EvidenceV2` と版の定数を足す。版付きの JSON Schema を `@loomake/core/schema/versions/` の 4 ファイル（verify 1.0.0・2.0.0、Evidence 1・2）として公開する
- `@loomake/kit`：終了コードを選ぶ `verifyExitCode`、`quality.yaml` を読む `readQualityFile`、品質条件の判定 `evaluateQualityConditions`・`qualitySubjectsGuard`・`summarizeVerifyChecks` を足す。実行時依存に `yaml` を加える
- `@loomake/trace`：新旧の証拠を Report 2 へ投影する処理を内部に足し、`LegacyEvidence`・`EvidenceV2` と版の定数を再エクスポートする。レポートの出力は変えない
