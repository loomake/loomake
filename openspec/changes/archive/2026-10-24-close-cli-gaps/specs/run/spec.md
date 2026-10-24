## ADDED Requirements

### Requirement: 壊れた設定ファイル
`loomake run` は、`loomake.config.json` を JSON として読めないとき、エンジンを呼ばず、実行の記録も作らずに、読めない理由を日本語で表示して終了コード 2 を返す SHALL。

Source: REQ-193

#### Scenario: JSON が壊れている
- **WHEN** `loomake.config.json` の中身が `{bad` のプロジェクトで `loomake run --change c1` を実行する
- **THEN** 標準エラーに `loomake.config.json を読めません` が含まれ、スタックトレースは出ず、実行の記録は作られず、終了コードは 2 である
