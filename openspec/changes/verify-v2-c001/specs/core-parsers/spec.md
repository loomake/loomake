## MODIFIED Requirements

### Requirement: verify 結果の Zod スキーマと型の導出
core は verify 結果の形を Zod スキーマで定義し、公開する SHALL。`VerifyResult`・`VerifyCheckResult`・`VerifyMode` の型はそのスキーマから導出する MUST。同じ形を手書きの型で別に定義してはならない MUST NOT。現在の書き出しは `schemaVersion: 2.0.0` とする SHALL。1.0.0の必須プロパティ・mode・status・coverageを受け付ける履歴専用スキーマと導出型も別名で公開し、現在の合格判定には使わない MUST。

Source: REQ-274

#### Scenario: いまの verify 結果を受け付ける
- **WHEN** `schemaVersion` が `1.0.0` で、`mode`・`change`・`ok`・`results`・`coverage` を持つ verify 結果を、core の履歴専用 Zod スキーマで解析する
- **THEN** 解析は成功する

#### Scenario: 形の違う verify 結果を拒否する
- **WHEN** 必須プロパティ `ok` のない verify 結果、または `status` が `pass`・`fail`・`warn`・`skip` 以外の verify 結果を、core の履歴専用 Zod スキーマで解析する
- **THEN** 解析は失敗する

### Requirement: 証拠とリリースレポートの構造スキーマ
core は既存の `Evidence`・`EvidenceDocument`・`Report`・`ReportRow` と同じデータ構造の Zod スキーマを公開し、4 型をそこから導出する SHALL。Evidence と Report の `schemaVersion` は number 型とし、現在の書き出しの定数はそれぞれ2・3とし、旧Evidence 1・Report 2の構造スキーマと型を別名で保持する MUST。`documents` は任意のままとし、空配列を補ってはならない MUST NOT。ReportRow の日本語の結果と null、各フィールドの必須・任意・null の区別を保持する SHALL。全 object 階層で未知のフィールドを拒否せず値を保持する SHALL。日時・SHA・パスなどに既存データ型にない新しい制約を加えてはならない MUST NOT。

Source: REQ-302

#### Scenario: 既存の証拠とレポートを解析する
- **WHEN** documents のある証拠とない証拠、日本語の結果と null を持つ既存のレポートを構造スキーマで解析する
- **THEN** 解析は成功し、入力したデータを保持して documents の省略も保持する

#### Scenario: 型と構造の互換性
- **WHEN** 既存型に合う任意の number の schemaVersion と、日時・SHA・パスを文字列として持つ値を履歴用構造スキーマで解析する
- **THEN** 構造として受け付け、必須の配列・文字列・boolean の型が違う値は拒否する

#### Scenario: 未知のフィールドを保持する
- **WHEN** 証拠とレポートの各 object 階層に未知のキーを持つ値を履歴用構造スキーマで解析する
- **THEN** 未知の値は解析結果に残る

### Requirement: trace の既存公開元と同期実行の維持
trace は移行した型と版の定数を従来の公開元から再エクスポートする SHALL。証拠の版・対象 change・日時・SHA・文書 hash・重複などの整合性検査、I/O、serializeEvidence・buildReport・runReport などの同期実行を維持する SHALL。現在の出力はEvidence 2・Report 3へ移し、旧1・2の閲覧時には旧型を明示して解釈する SHALL。新しいスキーマは構造の検査とし、既存の同期 validator を Zod に置き換えてはならない MUST NOT。core から kit・trace への依存を作らず、core の入口からは zod を静的に読まず、構造スキーマを使うときに遅延読み込みする MUST。

Source: REQ-303

#### Scenario: 同期 API と整合性検査
- **WHEN** 正しい証拠と版・日時・SHA・文書 hash などが不正な証拠を既存の同期関数へ渡す
- **THEN** 従来どおりの結果を同期的に返し、整形 JSON と末尾の改行も保持する

#### Scenario: 起動時の読み込みと公開型
- **WHEN** core と trace の入口から静的な import をたどり、従来の公開元の型・定数を利用する
- **THEN** zod を静的に読む経路がなく、新旧の型を明示した利用側がコンパイルできる

### Requirement: 証拠とレポートの JSON Schema の生成と公開
core は Evidence と Report の JSON Schema をそれぞれ `schema/evidence.schema.json`・`schema/report.schema.json` に Zod から生成し、通常と publishConfig の exports で公開する SHALL。生成結果と配布ファイルの不一致を CI の試験で検出する MUST。JSON Schema は構造スキーマと同じ必須・任意の区別と未知フィールドの許可を表す SHALL。verify・evidence・reportの現行公開JSON Schemaは新形式へ更新し、旧版は履歴fixtureと履歴用スキーマで保持する SHALL。quality・trace・spec・tasks・quality-reportのJSON Schemaは変更しない MUST。

Source: REQ-304

#### Scenario: 生成結果と公開物の一致
- **WHEN** 2 種類の JSON Schema を生成して配布ファイルと照合し、配布された core の公開入口から読む
- **THEN** 内容が一致し、証拠とレポートの同じ有効・無効入力を検証できる

#### Scenario: 既存 JSON Schema の保持
- **WHEN** スキーマを再生成する
- **THEN** quality・trace・spec・tasks・quality-reportの5ファイルは変わらず、verify・evidence・reportは新形式と一致し旧版fixtureも保持される

## ADDED Requirements

### Requirement: verify 2.0.0の状態とscope
coreは要件定義7.3の `schemaVersion: 2.0.0` のZodスキーマと導出型を公開する SHALL。ci/local各completed・partialとabortedを区別し、ciにはchecks・summary・decision・verdict、localにはchecks・summary・decisionとsummary.pendingを持たせverdictを持たせない MUST。abortedはchange・run.errorsを持ち、scope・checks・summary・decision・verdictを持たない MUST。全objectの未知キーは拒否せず値を保持し、既知の禁止キーは拒否する MUST。スキーマは遅延ロードする SHALL。

Source: REQ-308

#### Scenario: completedとabortedの最小契約
- **WHEN** ci/localのcompletedとabortedの2.0.0を解析する
- **THEN** 各必須項目を検査し、abortedのchecks・summary・decision・verdictとlocalのverdictを拒否する

#### Scenario: partialの構造と未完了範囲
- **WHEN** ci/localのpartialを解析する
- **THEN** 構造は受け付けるが、実証跡取得の部分失敗を発生させる経路と禁止フィールドの網羅試験はC-003へ残り、C-001完了を契約全体完了と表示しない

#### Scenario: 未知キーと公開型
- **WHEN** 各object階層へ `__proto__` を含む未知キーを渡し、配布物の型とloaderを利用する
- **THEN** 未知値を保持し、公開型がスキーマと一致し、入口からzodを静的に読まない

### Requirement: verifyの実行エラー
verifyの `run.errors` は種別 `usage/config/permission/tool/network/runtime`、対象target、日本語message、次の操作nextを持つ SHALL。change未確定時はchangeをnullとし、生の入力をエラーの対象へ残す MUST。usage/configのabortedは2、ほかのabortedは3に対応させる MUST。abortedを品質のFAILとして扱わない MUST。

Source: REQ-309

#### Scenario: changeが確定しない
- **WHEN** change必須ゲートでchange値欠落・不正なID・存在しないIDを指定する
- **THEN** change:nullのabortedとusageエラー、元の入力、次の操作を返す。bare verifyへの適用はR-C001-01の回答後に確定する

#### Scenario: 不正設定と読取失敗
- **WHEN** 設定の構文・型・対応版が不正、または権限等で読取不能になる
- **THEN** 前者をconfig、後者をpermission/runtimeのabortedとして区別する
