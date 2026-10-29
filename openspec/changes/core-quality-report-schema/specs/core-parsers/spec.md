## ADDED Requirements

### Requirement: quality-report の初期スキーマ

core は quality-report の Zod スキーマと、そのスキーマから導出した型を公開する SHALL。入力はオブジェクトとし、数値の `version: 1` だけを必須とする MUST。未知のフィールドは拒否せず、解析結果に値を変えずに残す SHALL。`version` の欠落、文字列の `"1"`、数値の `1` 以外は拒否する MUST。公開する JSON Schema は Zod スキーマから書き出した内容と一致する MUST。この契約の追加で既存のリリースレポートの `schemaVersion: 2` と JSON 出力を変更しない MUST。

core は初版の定数 `QUALITY_REPORT_SCHEMA_VERSION` を数値の `1` として公開し、`loadQualityReportSchema()` でスキーマを遅延ロードする SHALL。core と CLI の静的な入口から zod を読み込まない MUST。

Source: REQ-301

#### Scenario: 最小のレポートを解析する
- **WHEN** `{ "version": 1 }` を quality-report のスキーマで解析する
- **THEN** 解析は成功し、入力と同じ値が返る

#### Scenario: 必要なときにスキーマを読む
- **WHEN** core の入口から初版の定数と `loadQualityReportSchema()` を使う
- **THEN** 定数は数値の `1` で、Promise からスキーマを取得でき、core と CLI の静的な import の範囲に zod が含まれない

#### Scenario: 未知のフィールドを保持する
- **WHEN** `{ "version": 1, "extra": { "status": "unmeasured", "values": [1, null] } }` を解析する
- **THEN** 解析は成功し、`extra` の入れ子を含む値がそのまま残る

#### Scenario: 版が欠けるか異なる
- **WHEN** `{}`、`{ "version": "1" }`、`{ "version": 2 }` のいずれかを解析する
- **THEN** 解析は失敗する

#### Scenario: オブジェクト以外を解析する
- **WHEN** `null`、配列、数値、文字列のいずれかを解析する
- **THEN** 解析は失敗する

#### Scenario: 配布する JSON Schema を照合する
- **WHEN** Zod スキーマから JSON Schema を書き出し、core が公開する quality-report の JSON Schema と比べる
- **THEN** 内容が一致し、最小入力・未知のフィールド・不正な版の受理と拒否が一致する

#### Scenario: 既存のリリースレポートを出力する
- **WHEN** 従来と同じ文書と証跡から `trace report --format json` を実行する
- **THEN** 従来と同じ `schemaVersion: 2` の JSON が出力され、`version` への改名や新しい必須項目の追加はない
