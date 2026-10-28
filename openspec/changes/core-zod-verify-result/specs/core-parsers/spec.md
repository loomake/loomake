## ADDED Requirements

### Requirement: verify 結果の Zod スキーマと型の導出
core は verify 結果の形を Zod スキーマで定義し、公開する SHALL。`VerifyResult`・`VerifyCheckResult`・`VerifyMode` の型はそのスキーマから導出する MUST。同じ形を手書きの型で別に定義してはならない MUST NOT。スキーマは移す前と同じ形（`schemaVersion` が `1.0.0`、必須プロパティ、`mode` と `status` の値、`coverage` の形）を受け付ける SHALL。

Source: REQ-274

#### Scenario: いまの verify 結果を受け付ける
- **WHEN** `schemaVersion` が `1.0.0` で、`mode`・`change`・`ok`・`results`・`coverage` を持つ verify 結果を、core の Zod スキーマで解析する
- **THEN** 解析は成功する

#### Scenario: 形の違う verify 結果を拒否する
- **WHEN** 必須プロパティ `ok` のない verify 結果、または `status` が `pass`・`fail`・`warn`・`skip` 以外の verify 結果を、core の Zod スキーマで解析する
- **THEN** 解析は失敗する

### Requirement: verify 結果の未知のフィールド
core の verify 結果の Zod スキーマは、定義していないフィールドを拒否しない SHALL。解析結果にはそのフィールドを値を変えずに残す MUST。

Source: REQ-275

#### Scenario: 未知のフィールドを残す
- **WHEN** 最上位と `results` の要素に、定義していないフィールドを持つ verify 結果を解析する
- **THEN** 解析は成功し、解析結果に同じフィールドが同じ値で残っている

### Requirement: JSON Schema の書き出し
core が公開する `schema/verify-result.schema.json` は、verify 結果の Zod スキーマから `z.toJSONSchema()` で書き出した内容と一致する MUST。core は Zod スキーマからこのファイルを書き出すコマンドを提供する SHALL。ファイルと書き出した内容が違うときは、CI で動くテストが失敗する MUST。

Source: REQ-276

#### Scenario: 書き出した内容とファイルが一致する
- **WHEN** Zod スキーマから JSON Schema を書き出し、`packages/core/schema/` のファイルと比べる
- **THEN** 内容が一致する

#### Scenario: 書き出しのコマンドでファイルを作り直せる
- **WHEN** core の書き出しのコマンドを実行する
- **THEN** `packages/core/schema/verify-result.schema.json` が、Zod スキーマから書き出した内容になる
