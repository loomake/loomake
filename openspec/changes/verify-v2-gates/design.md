# Design: verify-v2-gates

## 分類（R-C001-08 B）

| 事象 | spec-only | done（local） | done（ci） |
|---|---|---|---|
| 未承認の仮定 | PASSの案内、0 | 不足＋要判断、1 | 不足＋要判断、1 |
| 確認待ちの要件 | PASSの案内、0 | 不足＋要判断、1 | 不足＋要判断、1 |
| 未知キー | PASSの案内 | PASSの案内 | PASSの案内 |
| OpenSpec CLI不在（auto） | NOT_APPLICABLE（local） / 不足（ci） | 同左 | 不足 |
| `--skip-commands` | （品質コマンドを動かさない） | 不足、1 | 不足、1 |

## 実装

- `run.ts` の `GateCheck` に `na` を足す。`toCheck` で NOT_APPLICABLE へ写す
- `checkSpec` に gate を渡す。done では「仮定の承認」「確認待ちが残っていない」を `insufficient` にし、同じ事象を `decision.reasons`（code: APPROVAL_REQUIRED、target: ID）へ集める。「確認待ちの要件」の案内は spec-only だけに出す（done では「確認待ちが残っていない」が同じIDを示す）
- `decision` は `assembleVerifyResult` の `decision` 引数に渡す。終了コードの選び方（`verifyExitCode`）は変えない（`decision.required` なら1）
- NOT_APPLICABLE の確認者は、人ではなく自動判定であることを示す固定の文字列にする（trace の確認事項 S9-02。回答まではおすすめのAで実装する）
- spec-only で品質項目を数えない：quality.yaml はまだ接続しないので、checks に `quality:` を作らないことを試験で固定する
- `decision.reasons` の code は APPROVAL_REQUIRED、target は仮定または要件の ID にする。既存の code のうち、人の承認が足りない状態を表すのはこれだけである
- NOT_APPLICABLE の evidence は空にする。理由と確認者は reason に書く
