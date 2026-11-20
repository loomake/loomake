# Design

## Context

verify の外へ出る値は、戻り値（`assembleVerifyResult` と、quality.yaml の読取エラーによる早期の aborted 戻り値）、`verifyAbortedResult`、progress の文字列、`formatVerifyResult` の文字列、CLI の標準エラーの 5 つである。trace record は runVerify の戻り値をそのまま Evidence の `verify` に保存するので、戻り値を置換すれば保存される verify の部分も置換済みになる。

## Decisions

- 戻り値は `maskValue` で置換する。`assembleVerifyResult`・`verifyAbortedResult` と早期の aborted 戻り値の 3 か所を通せば、check の reason、実行エラーの message、decision の理由、coverage がすべて含まれる。maskValue は欠落した省略項目を補わず、終了コードと判定は変わらない。
- 品質コマンドの出力は、全文を `maskSecrets` で置換してから末尾 30 行を取り、取った結果をもう一度置換する。`openspec validate` の出力も同じ順で、先頭 2000 文字を取る。上限の値は変えない。切ってから置換すると秘密鍵ブロックの BEGIN 行が消えて本文が残るためである。
- progress は runVerify の入口で包み、渡す文字列を置換する。
- `formatVerifyResult` は、整形した全文を置換して返す。直接呼ぶ利用者（runner の prompt など）にも効く。
- CLI は共通のエラー表示（`loomake <command>: <message>`）と verify の --json 時の標準エラーを置換する。--json の標準出力は置換済みの戻り値を整形するので、JSON の構文は保たれる。
- onCommand は変えない。通知の値に出力は含まれず、置換すると REQ-455 の「実際の終わり方を伝える」契約を変える。

## Risks

- 置換は REQ-118・REQ-199 の既知の形だけで、任意のパスワードや個人情報は保証しない。
- 全文の置換は出力が大きいと遅くなる。出力は既存の上限（64MB）の範囲に収まる。性能の専用試験は置かず、既存の試験の時間を弱めない。
- 戻り値の置換で置換後の key が重なると maskValue が UsageError を投げる。coverage の key は要件 ID なので通常は起きない。
