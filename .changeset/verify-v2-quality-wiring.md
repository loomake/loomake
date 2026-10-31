---
"@loomake/kit": minor
"@loomake/trace": minor
"loomake": minor
"@loomake/runner": patch
---

verify の CI の完了ゲート（`--done`、scope ci）で、リポジトリ直下の quality.yaml を読み、`ci.test_report` の観測で品質を判定する。

- `@loomake/kit`：`runVerify` に `qualitySchema` を足し、`loadVerifyQualitySchema()` を公開する。ci の完了ゲートでは quality.yaml が必須で、ないときは aborted（終了コード 3）、誤りは aborted（2）、読む権限がないときは aborted（3）にする。品質コマンドの前に対象のコミットと基準の hash を取り、前回のレポートを消してから実行し、テストランナーと版・前後のコミット・基準の hash・レポートの本文と sha256・実行の時刻・品質コマンドの終了コードを adapter に渡す。終了コードが 0 以外なら、成功のレポートでも品質の証跡に数えない。`quality:subjects` と `quality:<ID>` の check を足す。仕様ゲートとローカルの完了ゲートは、quality.yaml があれば形だけを確かめ、品質の check は足さない
- `loomake`：`verify` が quality.yaml のスキーマを読んで渡す
- `@loomake/trace`：`runRecord` に `qualitySchema` を足し、`trace record` の完了ゲートに渡す
- `@loomake/runner`：`loomake run` の完了ゲートに quality.yaml のスキーマを渡す
