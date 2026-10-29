## ADDED Requirements

### Requirement: Markdown 解析結果の Zod スキーマと導出型

core は trace.md・spec.md・tasks.md の解析結果の Zod スキーマを提供し、既存の公開型 `Trace`・`LedgerRow`・`QuestionRow`・`AssumptionRow`・`SpecOperation`・`SpecRequirement`・`Task` をそのスキーマから導出する SHALL。既存の同期パーサ API、戻り値、意味検証、位置情報を維持し、スキーマのオブジェクトは未知フィールドを許す SHALL。

Source: REQ-298

#### Scenario: 既存の解析結果を検証する

- **WHEN** 既存の trace・spec・tasks パーサの解析結果を対応するスキーマに渡す
- **THEN** 必須の値と配列の形を検証でき、既存の公開型は対応するスキーマから導出されている

#### Scenario: 不正な台帳の状態を診断する

- **WHEN** 状態が「対応中」の台帳をパーサに渡す
- **THEN** 元の状態文字列を解析結果に残し、従来どおりファイル名と行番号つきの解析エラーを返す

#### Scenario: 既存の境界値を保つ

- **WHEN** 合意の列がない古い trace、RENAMED と操作の見出しのない Requirement を含む spec、空の tasks を解析する
- **THEN** 古い trace の合意の列は空文字列、RENAMED の from は任意の文字列、見出しのない操作は null、空の tasks は空配列として従来どおり返り、各スキーマがその解析結果を受け付ける

#### Scenario: 未知フィールドを保持する

- **WHEN** 既存の解析結果に未知フィールドを加え、対応するスキーマで解析する
- **THEN** 未知フィールドを拒否せず、値をそのまま保持する

### Requirement: 解析結果スキーマのバージョン定数と遅延ロード

core は `TRACE_SCHEMA_VERSION`・`SPEC_SCHEMA_VERSION`・`TASKS_SCHEMA_VERSION` を各 `1.0.0` として公開する SHALL。バージョンを Markdown・パーサの返却データへ追加しない MUST。`loadParserSchemas()` でスキーマを遅延ロードし、core と CLI の入口から静的にたどれる import が Zod を読み込まない SHALL。

Source: REQ-299

#### Scenario: 初版の定数と既存のデータ形式

- **WHEN** core の入口で各バージョン定数と同期パーサを使う
- **THEN** 3 つの定数は各 `1.0.0` であり、Markdown とパーサの返却データに version は追加されない

#### Scenario: 必要なときにスキーマを読む

- **WHEN** `loadParserSchemas()` を呼び出す
- **THEN** Promise から trace・spec・tasks と各行のスキーマが得られ、core と CLI の入口から静的にたどれる範囲に Zod は含まれない

### Requirement: 解析結果の JSON Schema の公開と生成差分の検出

core は Zod から trace・spec・tasks の解析結果の JSON Schema を生成し、配布物の `@loomake/core/schema/trace.schema.json`・`spec.schema.json`・`tasks.schema.json` で公開する SHALL。生成結果は従来の解析結果の形を記述し、独自のバージョン annotation を追加しない SHALL。生成結果と管理するファイルの差分を CI のテストで検出する SHALL。

Source: REQ-300

#### Scenario: 配布物からスキーマを読む

- **WHEN** 配布された core の 3 つの JSON Schema を公開 exports から読む
- **THEN** trace は台帳・確認事項・仮定のオブジェクト、spec と tasks は配列を記述し、既存の解析結果を検証できる

#### Scenario: 同じスキーマを生成する

- **WHEN** JSON Schema の書き出しを実行し、管理する JSON ファイルと比較する
- **THEN** 3 形式を含む全スキーマが一致し、ファイルを変更すると差分を検出する
