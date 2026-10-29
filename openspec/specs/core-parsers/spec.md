# core-parsers Specification

## Purpose
`@loomake/core` が、trace.md・spec.md・tasks.md・テストランナーの JSON レポートをどう読み、verify の結果をどの形で表すかを定める。kit・CLI など後続のツールは、この読み方と JSON スキーマを共有する。

## Requirements

### Requirement: trace.md の 3 つの表の読み取り
core は trace.md の「要件台帳」「確認事項」「仮定」の 3 つの表を読み、型付きのオブジェクトとして返す SHALL。確認事項には「回答者」「回答日」を、仮定には「承認者」「承認日」を含めて返す SHALL。この 4 つの列が表にないときは、空の文字列として返し、エラーにしない SHALL。それ以外の列が表にないときは、その表と列の名前を示す解析エラーを返す SHALL。

Source: REQ-011, REQ-077, REQ-078

#### Scenario: 3 つの表が読み取れる
- **WHEN** 3 つの表を持つ trace.md のテキストを `parseTrace` に渡す
- **THEN** 台帳・確認事項・仮定が列名をキーにした型付きの配列として返る

#### Scenario: 表が欠けている
- **WHEN** 「要件台帳」の表が無い trace.md のテキストを渡す
- **THEN** 空の台帳が返り、エラーに「要件台帳」の表が無いことが含まれる

#### Scenario: 行末が CRLF の trace.md
- **WHEN** 行末を CRLF にした trace.md のテキストを渡す
- **THEN** 行末が LF の同じ trace.md と同じ台帳・確認事項・仮定が返り、値の末尾に `\r` が残らない

#### Scenario: 合意の列を読む
- **WHEN** 回答者が「プロダクト責任者」、回答日が 2026-10-23 の確認事項と、承認者が「開発リーダー」、承認日が 2026-10-23 の仮定を持つ trace.md を渡す
- **THEN** 確認事項の `回答者`・`回答日` と、仮定の `承認者`・`承認日` に、その値が入る

#### Scenario: 合意の列のない古い trace.md
- **WHEN** 回答者・回答日・承認者・承認日の列がない trace.md を渡す
- **THEN** エラーなく読め、その 4 つの値は空の文字列である

#### Scenario: 必須の列がない
- **WHEN** 確認事項の表の「ブロッキング」の列名を「ブロッキング?」にした trace.md を渡す
- **THEN** エラーに、「確認事項」の表に「ブロッキング」の列がないことが含まれる

### Requirement: 台帳の状態値の検査
core は要件台帳の「状態」が 反映済・確認待ち・範囲外・既存仕様で充足 のいずれでもない行を、エラーとして報告する SHALL。

Source: REQ-012

#### Scenario: 不正な状態値
- **WHEN** 「状態」が「対応中」の行を含む trace.md を渡す
- **THEN** その行の ID と値「対応中」を含むエラーが報告される

#### Scenario: 4 つの状態値
- **WHEN** 状態が 反映済・確認待ち・範囲外・既存仕様で充足 の行だけを含む trace.md を渡す
- **THEN** 状態値に関するエラーは報告されない

### Requirement: 差分仕様の読み取り
core は OpenSpec の差分仕様（spec.md）から、Requirement ごとに 操作（ADDED・MODIFIED・REMOVED・RENAMED）、名前、Source の要件 ID、Scenario 数を取り出す SHALL。OpenSpec 1.14 以上の書式を読める MUST。

Source: REQ-013, REQ-051

#### Scenario: ADDED の Requirement
- **WHEN** `## ADDED Requirements` の下に `Source: REQ-001, REQ-002` と 2 つの Scenario を持つ Requirement を含む spec.md を渡す
- **THEN** 操作 `ADDED`、名前、Source `["REQ-001", "REQ-002"]`、Scenario 数 2 が返る

#### Scenario: 4 つの操作
- **WHEN** ADDED・MODIFIED・REMOVED・RENAMED の見出しを持つ spec.md を渡す
- **THEN** 各 Requirement に、属する見出しに対応する操作が付く

#### Scenario: 行末が CRLF の spec.md
- **WHEN** 行末を CRLF にした spec.md を渡す
- **THEN** 行末が LF の同じ spec.md と同じ操作・名前・Source・Scenario 数が返る

### Requirement: タスクの読み取り
core は tasks.md から、チェック済み（`- [x]`・`- [X]`）と未チェック（`- [ ]`）のタスクを取り出す SHALL。箇条書きの記号は `-`・`*`・`+` のどれでもよい SHALL。

Source: REQ-014

#### Scenario: チェックの混在
- **WHEN** 完了 2 件・未完了 1 件のタスクを持つ tasks.md を渡す
- **THEN** チェック済み 2 件と未チェック 1 件が、それぞれ行番号つきで返る

#### Scenario: 行末が CRLF の tasks.md
- **WHEN** 行末を CRLF にした tasks.md を渡す
- **THEN** 行末が LF の同じ tasks.md と同じタスクが返り、タスクの文に `\r` が残らない

#### Scenario: `*`・`+` の箇条書き
- **WHEN** `* [ ] 1.1` と `+ [x] 1.2` の行を持つ tasks.md を渡す
- **THEN** 未チェックの 1.1 とチェック済みの 1.2 が返る

### Requirement: テストが対象とする要件 ID の抽出
core はテストランナーの JSON レポートから、成功したテストの名前にある `[REQ-xxx]` 形式の要件 ID を、テストファイルごとに取り出す SHALL。skip・todo のテストと、失敗したテストは数えない MUST。

Source: REQ-015

#### Scenario: 通常のテスト
- **WHEN** `status` が `passed` で、名前が `[REQ-012][REQ-013] ...` のテストを含むレポートを渡す
- **THEN** そのテストファイルについて `REQ-012` と `REQ-013` が返る

#### Scenario: skip と todo
- **WHEN** 名前に `[REQ-020]`・`[REQ-021]`・`[REQ-022]` を持つテストの `status` が、それぞれ `skipped`・`todo`・`pending` であるレポートを渡す
- **THEN** 要件 ID は返らない

#### Scenario: 失敗したテスト
- **WHEN** 名前に `[REQ-023]` を持つテストの `status` が `failed` であるレポートを渡す
- **THEN** 要件 ID は返らない

#### Scenario: describe の名前にある要件 ID
- **WHEN** describe の名前が `[REQ-024] ...` で、その中のテストの `status` が `passed` であるレポートを渡す
- **THEN** そのテストファイルについて `REQ-024` が返る

#### Scenario: 読めないレポート
- **WHEN** JSON として読めないテキストを渡す
- **THEN** 空の結果と、ファイル名を含むエラーが返る

### Requirement: verify 結果の JSON スキーマ
core は verify 結果の JSON スキーマを公開し、スキーマに `schemaVersion` を含める SHALL。スキーマに破壊的変更を入れるときは `schemaVersion` のメジャー番号を上げる MUST。

Source: REQ-016, REQ-053

#### Scenario: スキーマが公開されている
- **WHEN** `@loomake/core` のスキーマを読む
- **THEN** `schemaVersion` が必須プロパティとして定義されている

#### Scenario: 破壊的変更でメジャー番号が上がる
- **WHEN** スキーマの必須プロパティを削除・改名する変更を加える
- **THEN** スキーマの `schemaVersion` のメジャー番号が前の版より大きい

### Requirement: trace.md のテンプレート生成
core は trace.md の空のテンプレートを生成する関数を提供する SHALL。テンプレートの確認事項の表は「回答者」「回答日」の列を、仮定の表は「承認者」「承認日」の列を、それぞれ末尾に持つ SHALL。kit が配る trace.md の雛形も同じ列を持つ SHALL。

Source: REQ-017, REQ-077, REQ-078

#### Scenario: 生成したテンプレートを読める
- **WHEN** `createTraceTemplate({ changeId: "add-x" })` の結果を `parseTrace` に渡す
- **THEN** エラーなく読み取れ、台帳・確認事項・仮定が空である

#### Scenario: テンプレートに合意の列がある
- **WHEN** `createTraceTemplate` の結果と、kit が配る trace.md の雛形を読む
- **THEN** どちらも、確認事項の表の見出しが「回答」「回答者」「回答日」で終わり、仮定の表の見出しが「承認」「承認者」「承認日」で終わる

### Requirement: 解析エラーの位置情報
core の解析エラーはファイル名と行番号を含む SHALL。

Source: REQ-018

#### Scenario: 位置情報つきのエラー
- **WHEN** 3 行目に不正な状態値を持つ trace.md を、ファイル名 `trace.md` で渡す
- **THEN** エラーの `file` が `trace.md`、`line` が不正な行の行番号である

### Requirement: OpenSpec 書式との互換
Loomake の追加書式（`Source:` 行と trace.md）を含む change は、`openspec validate --strict` を通る SHALL。Loomake は独自の仕様書式を導入しない MUST。

Source: REQ-052, REQ-058

#### Scenario: 追加書式を含む change の検証
- **WHEN** `Source:` 行つきの spec.md と trace.md を持つ change に `openspec validate --strict` を実行する
- **THEN** 終了コード 0 で終わる

### Requirement: core の実行時依存の範囲
`@loomake/core` の外部の実行時依存は `zod` だけとする SHALL。`@loomake/core` の `package.json` の `dependencies` は `zod` 以外のパッケージを含まない MUST。

Source: REQ-046

#### Scenario: zod 以外の依存がない
- **WHEN** `packages/core/package.json` の `dependencies` を読む
- **THEN** `zod` 以外のパッケージが含まれない（`dependencies` が存在しないか空のときも、この条件を満たす）

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
