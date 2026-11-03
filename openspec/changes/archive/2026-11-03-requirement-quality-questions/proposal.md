# 要件ごとの品質確認と未定義の受け入れ条件

## Why

#66 の FR-02/03 は、要件ごとの品質の定義を確認し、受け入れ条件を定義できなければ仕様ゲートで止めることを求める。既存の曖昧さ確認に五項目の記録と判定基準を加え、入力にない値の補完を防ぐ。

## What Changes

- 範囲外を除く全要件について、目的・利用状況・受け入れ条件・計測方法・副特性を確認し、出典または関連 REQ つき Q を記録する。
- trace の既存の表を保ち、末尾に「品質の定義」を追加する。
- 受け入れ条件や合否の判定方法を定義できない場合は blocking Q と確認待ちにする。既存の六分類と実装への影響による判断を保つ。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `req-to-openspec-skill`: 五項目の確認・記録と、FR-03 の blocking 判定を追加する。

## Impact

両方の req-to-openspec Skill、trace 雛形、構造試験、既存 verify を使う互換試験、利用ガイドに追加する。品質 YAML の提案と合意・反映は後続 B1/B2 に残す。parser、公開型、schema、runtime、依存、設定は変えない。
