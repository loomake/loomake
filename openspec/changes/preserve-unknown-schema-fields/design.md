# Design

## Context

問題と承認は proposal.md を参照する。既存のスキーマは `z.looseObject` を使い、検証するオブジェクトの `__proto__` を失う。未知値の内部の同名キーと `constructor`・`prototype` は保持される。既存の JSON Schema 生成は `renderJsonSchemas()` に集約されている。

## Goals / Non-Goals

成功した検証の出力に、失われた own property だけを安全に復元する。既知フィールドの検証と既定値は元のスキーマに任せる。この変更で CLI の JSON 形式の版や verify 2.0 の契約を追加しない。

## Decisions

未知フィールドを許す各オブジェクトのスキーマを clone し、その clone の `_zod.run` だけを装飾する。元の入力と解析コンテキストを native parser へそのまま渡し、成功した出力の最上位の own property だけを `Object.defineProperty` で復元する。入れ子と配列要素のオブジェクトは、それぞれの clone で保持する。未知値の内部と、キーに制約のある record は走査しない。元のスキーマと依存ライブラリへ変更を加えず、検証・診断の設定・同期と非同期の動作を保つ。

スキーマの構造・型・metadata を保つため、JSON Schema は従来の `z.toJSONSchema()` で生成する。custom 型の特例や default 注釈の再構築は追加しない。非表現スキーマの例外と `io:input` が出力側の変換を省く規則も維持する。対象の公開スキーマは metadata 設定後に保持処理を適用し、適用後の任意の派生スキーマへ保持処理を継承する保証は追加しない。

公開 API の custom・transform と内側の safeParse を使う案は、呼び出し側の error 設定が record の子診断へ届かず、JSON の default 注釈も失うため採用しない。公開 overwrite のパイプラインと退避キーを使う案も、失敗時の診断入力に退避キーが残るため採用しない。未知キーの除外は、利用者が保持修正を選んだため採用しない。

[Zod Core の公式説明](https://zod.dev/packages/core) は他ライブラリによる拡張を想定し、`_zod.run` を内部 parser として説明している。今回は各対象スキーマの新しい clone に限って使用する。ライブラリ全体のパッチは行わない。

## Risks / Trade-offs

- 入れ子で元入力と出力を取り違えると値を失う。各公開スキーマの検証対象の階層と配列要素を回帰試験に含める。
- `_zod.run` は内部 API への依存となる。Zod の版を更新するときは、native の診断・型・metadata・同期と非同期の解析・配布 JSON の回帰を確認する。元スキーマと clone が独立していることも試験する。
- 生成時の特例は設けず、非表現スキーマが失敗する試験と既存 JSON の一致試験を残す。
- PR #134 の trace スキーマは別担当の作業中である。この worktree へ未完成の変更を写さず、main に統合された時点で同じ保持規則を確認する。

## Migration Plan

保持されなかったデータの欠落を直す patch として changeset を追加する。既存のデータ形式の版は上げず、配布 JSON に差分を出さない。問題が見つかった場合は修正 PR を差し戻し、元のスキーマと回帰試験で原因を確認する。
