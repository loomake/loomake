## ADDED Requirements

### Requirement: quality.yaml のスキーマと版
core は quality.yaml を YAML として解析した値の Zod スキーマを公開する SHALL。スキーマは形式の版 `version` を必須にし、core が対応する版（`2`）以外を拒否する MUST。`model` と、各目標・要件の `characteristic` は必須とし、空でない文字列であることだけを確かめる SHALL。`subcharacteristic` と、証拠・指標の `metric`・`source` も、空でない文字列であることだけを確かめる SHALL。`evidence` と `indicators` は、省くと空の配列になる SHALL。`target` は `<=`・`>=`・`==`・`<`・`>` のどれかと数値の組でなければならない MUST。期間（`window` など）は、正の整数と `d`・`w`・`y` のどれかでなければならない MUST。定義していないフィールドは拒否せず、解析結果に残す SHALL。

Source: REQ-283

#### Scenario: 要件定義 7.1 の例を受け付ける
- **WHEN** 要件定義 7.1 の quality.yaml の例を解析した値を、core のスキーマで解析する
- **THEN** 解析は成功する

#### Scenario: 版のない quality.yaml を拒否する
- **WHEN** `version` のない値、または `version` が `1` の値を解析する
- **THEN** 解析は失敗する

#### Scenario: 書式の違う target と期間を拒否する
- **WHEN** `target` が `about 1800` の値、または `defaults.window` が `2m` の値を解析する
- **THEN** 解析は失敗する

### Requirement: quality.yaml の型の導出と遅延読み込み
quality.yaml の型は Zod スキーマから導出する MUST。`@loomake/core` の入口は zod を静的に読まず、スキーマは解析で使うときに読む SHALL。

Source: REQ-284

#### Scenario: 入口から zod を読まない
- **WHEN** `@loomake/core` の入口から静的にたどれるファイルを調べる
- **THEN** zod を読むファイルが含まれない

### Requirement: 証跡の保管方針の既定値
quality.yaml の `evidence:` は要件定義 7.1 の最小スキーマのとおりに、省いたキーへ既定値を補う SHALL。enum の値が不正なときは、解析を失敗させる MUST。

Source: REQ-285

#### Scenario: evidence: を省く
- **WHEN** `evidence:` のない quality.yaml を解析する
- **THEN** `artifact_retention` が `90d`、`long_term_store` が `github-release`、`long_term_retention` が `5y`、`access` が `project-members`、`delete_policy` が `owner-approval` になる

#### Scenario: 不正な保管先
- **WHEN** `evidence.long_term_store` が `s3` の quality.yaml を解析する
- **THEN** 解析は失敗する

### Requirement: 対象外の項目の理由と確認者
`applicability` は `applicable` か `not_applicable` とする MUST。`applicability` が `not_applicable` の目標・要件は、`reason` と `confirmed_by` を持たなければならない MUST。

Source: REQ-286

#### Scenario: 確認者のない対象外
- **WHEN** `applicability: not_applicable` で `confirmed_by` のない製品品質要件を解析する
- **THEN** 解析は失敗する

### Requirement: quality.yaml の JSON Schema の書き出し
core が公開する `schema/quality.schema.json` は、quality.yaml の Zod スキーマから `z.toJSONSchema()` で書き出した内容と一致する MUST。ファイルと書き出した内容が違うときは、CI で動くテストが失敗する MUST。

Source: REQ-287

#### Scenario: 書き出した内容とファイルが一致する
- **WHEN** Zod スキーマから JSON Schema を書き出し、`packages/core/schema/quality.schema.json` と比べる
- **THEN** 内容が一致する
