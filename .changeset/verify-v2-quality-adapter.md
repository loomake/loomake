---
"@loomake/core": minor
"@loomake/kit": minor
---

テストのレポートを品質の観測にする純関数を足す（追加だけ。verify の判定にはまだつながない）。

- `@loomake/core`：`parseTestReport` を足す。テストのレポートから、すべてのテストの file・fullName・status・要件 ID と、最上位の `startTime` を読む。`extractTestRequirements` の結果は変えない
- `@loomake/kit`：`observeTestReport`・`TEST_REPORT_SOURCE`・`FAILED_SUBJECTS_METRIC` と型 `TestReportReceipt` を足す。producer と版・対象のコミット・基準の hash・同じ実行で作られたレポートかを照合し、`ci.test_report` の `required_subjects_with_failed_tests` の観測を返す。`QualityObservation` に省略できる `detail` を足し、不足の理由に添える
