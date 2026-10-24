## ADDED Requirements

### Requirement: 要件モデルの検証結果を使う
verifyはcoreの要件と合意のモデルを検証し、変換時に不正な要件IDか状態を見つけたときはゲートを不合格にする SHALL。正常な入力のブロッキング質問、確認待ち、仮定の承認、テストの対応は既存の判定を維持する SHALL。

Source: REQ-150

#### Scenario: 不正な要件ID
- **WHEN** 台帳の要件IDが不正なchangeを検証する
- **THEN** モデルの整合性エラーとして不合格を返す

