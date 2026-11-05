# Proposal

## Why

W1-11 の評価収集側は、品質コマンドの正常な非0終了と、起動失敗・信号・期限超過を区別する必要がある。現在の verify 結果はこれらを同じ失敗へまとめるため、既存の実行経路から終わり方だけを任意に受け取れるようにする。

## What Changes

- `@loomake/kit` の `VerifyOptions` に任意の `onCommand` を追加し、公開型 `QualityCommandOutcome` で品質コマンドの終わり方を通知する。
- 同じ実行について、通知の有無で verify の結果・JSON・終了コード・実行順序と予算を変えない。通知側の例外は既存の progress と同様に呼出元へ伝える。
- C2 `trace-static-evaluation` の前提として独立した通常 L3 で受け入れる。C2 を部分完了にはしない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `verify`: 品質コマンドの任意通知と、既存結果を維持する公開 API の追加（REQ-455・456）。

## Impact

kit の verify 本体・公開型 export、型利用 fixture、通知と互換性の回帰試験、kit の minor changeset、API の説明。依存・設定・CLI フラグ・公開 JSON を増やさない。

## Non-goals

C2 の receipt 作成・bail 完全性判定・手動 FIFO・帳簿・履歴、C3 status、定期実行、Actions 照合を含めない。REQ-430 の観測判定や既存 verify の失敗分類を変更しない。shell の子孫の終了や bail が検出できたとは扱わない。
