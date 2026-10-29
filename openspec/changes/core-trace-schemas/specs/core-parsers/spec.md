## ADDED Requirements

### Requirement: 証拠とリリースレポートの構造スキーマ
core は既存の `Evidence`・`EvidenceDocument`・`Report`・`ReportRow` と同じデータ構造の Zod スキーマを公開し、4 型をそこから導出する SHALL。Evidence と Report の `schemaVersion` は number 型とし、現在の定数はそれぞれ 1・2 を保つ MUST。`documents` は任意のままとし、空配列を補ってはならない MUST NOT。ReportRow の日本語の結果と null、各フィールドの必須・任意・null の区別を保持する SHALL。全 object 階層で未知のフィールドを拒否せず値を保持する SHALL。日時・SHA・パスなどに既存データ型にない新しい制約を加えてはならない MUST NOT。

Source: REQ-302

#### Scenario: 既存の証拠とレポートを解析する
- **WHEN** documents のある証拠とない証拠、日本語の結果と null を持つ既存のレポートを構造スキーマで解析する
- **THEN** 解析は成功し、入力したデータを保持して documents の省略も保持する

#### Scenario: 型と構造の互換性
- **WHEN** 既存型に合う任意の number の schemaVersion と、日時・SHA・パスを文字列として持つ値を解析する
- **THEN** 構造として受け付け、必須の配列・文字列・boolean の型が違う値は拒否する

#### Scenario: 未知のフィールドを保持する
- **WHEN** 証拠とレポートの各 object 階層に未知のキーを持つ値を解析する
- **THEN** 未知の値は解析結果に残る

### Requirement: trace の既存公開元と同期実行の維持
trace は移行した型と版の定数を従来の公開元から再エクスポートする SHALL。証拠の版・対象 change・日時・SHA・文書 hash・重複などの整合性検査、I/O、serializeEvidence・buildReport・runReport などの同期実行と出力は従来どおりとする SHALL。新しいスキーマは構造の検査とし、既存の同期 validator を Zod に置き換えてはならない MUST NOT。core から kit・trace への依存を作らず、core の入口からは zod を静的に読まず、構造スキーマを使うときに遅延読み込みする MUST。

Source: REQ-303

#### Scenario: 同期 API と整合性検査
- **WHEN** 正しい証拠と版・日時・SHA・文書 hash などが不正な証拠を既存の同期関数へ渡す
- **THEN** 従来どおりの結果を同期的に返し、整形 JSON と末尾の改行も保持する

#### Scenario: 起動時の読み込みと公開型
- **WHEN** core と trace の入口から静的な import をたどり、従来の公開元の型・定数を利用する
- **THEN** zod を静的に読む経路がなく、従来の利用側がコンパイルできる

### Requirement: 証拠とレポートの JSON Schema の生成と公開
core は Evidence と Report の JSON Schema をそれぞれ `schema/evidence.schema.json`・`schema/report.schema.json` に Zod から生成し、通常と publishConfig の exports で公開する SHALL。生成結果と配布ファイルの不一致を CI の試験で検出する MUST。JSON Schema は構造スキーマと同じ必須・任意の区別と未知フィールドの許可を表す SHALL。既存の verify・quality・trace・spec・tasks の JSON Schema は変更しない MUST。

Source: REQ-304

#### Scenario: 生成結果と公開物の一致
- **WHEN** 2 種類の JSON Schema を生成して配布ファイルと照合し、配布された core の公開入口から読む
- **THEN** 内容が一致し、証拠とレポートの同じ有効・無効入力を検証できる

#### Scenario: 既存 JSON Schema の保持
- **WHEN** スキーマを再生成する
- **THEN** 既存 5 ファイルの内容は変わらない
