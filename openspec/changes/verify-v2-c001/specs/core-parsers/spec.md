## MODIFIED Requirements

### Requirement: verify 結果の Zod スキーマと型の導出
core は verify 結果の形を Zod スキーマで定義し、公開する SHALL。`VerifyResult`・`VerifyCheckResult`・`VerifyMode` の型はそのスキーマから導出する MUST。同じ形を手書きの型で別に定義してはならない MUST NOT。現在の書き出しは `schemaVersion: 2.0.0` とする SHALL。1.0.0の必須プロパティ・mode・status・coverageを受け付ける履歴専用スキーマと導出型も別名で公開し、現在の合格判定には使わない MUST。

Source: REQ-274

#### Scenario: いまの verify 結果を受け付ける
- **WHEN** 現行の2.0.0の状態別必須項目を持つverify結果を現行スキーマで解析する
- **THEN** 解析は成功し、履歴の1.0.0とは版で区別する

#### Scenario: 履歴の1.0.0を受け付ける
- **WHEN** `schemaVersion` が `1.0.0` で、`mode`・`change`・`ok`・`results`・`coverage` を持つ verify 結果を、core の履歴専用 Zod スキーマで解析する
- **THEN** 解析は成功する

#### Scenario: 形の違う verify 結果を拒否する
- **WHEN** 必須プロパティ `ok` のない verify 結果、または `status` が `pass`・`fail`・`warn`・`skip` 以外の verify 結果を、core の履歴専用 Zod スキーマで解析する
- **THEN** 解析は失敗する

### Requirement: 証拠とリリースレポートの構造スキーマ
coreは現行Evidence 2/verify 2.0.0と履歴Evidence 1/verify 1.0.0を別の構造スキーマと型で公開し、EvidenceDocument・Report・ReportRowも対応するスキーマから導出する SHALL。Evidence と Report の `schemaVersion` は number 型とし、Evidenceの現在の書き出しの定数は2とし、旧Evidence 1の構造スキーマと型を別名で保持する MUST。Reportの定数2・外形・日本語結果を維持する MUST。`documents` は任意のままとし、空配列を補ってはならない MUST NOT。ReportRow の日本語の結果と null、各フィールドの必須・任意・null の区別を保持する SHALL。全 object 階層で未知のフィールドを拒否せず値を保持する SHALL。日時・SHA・パスなどに既存データ型にない新しい制約を加えてはならない MUST NOT。

Source: REQ-302

#### Scenario: 既存の証拠とレポートを解析する
- **WHEN** documentsのある/ない現行Evidence 2を現行スキーマへ、履歴Evidence 1を履歴スキーマへ、日本語の結果とnullを持つReport 2をReportスキーマへ渡す
- **THEN** 解析は成功し、入力したデータを保持して documents の省略も保持する

#### Scenario: 型と構造の互換性
- **WHEN** 履歴型に合う任意のnumberのschemaVersionと日時・SHA・パスを文字列として持つ値を履歴用構造スキーマで解析する。現行Evidence 2も対応するv2構造スキーマで別に解析する
- **THEN** 構造として受け付け、必須の配列・文字列・boolean の型が違う値は拒否する

#### Scenario: 未知のフィールドを保持する
- **WHEN** 現行Evidence 2/verify 2.0.0、履歴Evidence 1/verify 1.0.0、Report 2それぞれの各object階層に未知キーを持つ値を対応する版の構造スキーマで解析する
- **THEN** 未知の値は解析結果に残る

### Requirement: trace の既存公開元と同期実行の維持
trace は移行した型と版の定数を従来の公開元から再エクスポートする SHALL。証拠の版・対象 change・日時・SHA・文書 hash・重複などの整合性検査、I/O、serializeEvidence・buildReport・runReport などの同期実行を維持する SHALL。現在の証拠出力はEvidence 2へ移し、旧Evidence 1の閲覧時には旧型を明示して解釈する SHALL。Reportの外形と版2は維持する SHALL。新しいスキーマは構造の検査とし、既存の同期 validator を Zod に置き換えてはならない MUST NOT。core から kit・trace への依存を作らず、core の入口からは zod を静的に読まず、構造スキーマを使うときに遅延読み込みする MUST。

Source: REQ-303

#### Scenario: 同期 API と整合性検査
- **WHEN** 正しい証拠と版・日時・SHA・文書 hash などが不正な証拠を既存の同期関数へ渡す
- **THEN** 従来どおりの結果を同期的に返し、整形 JSON と末尾の改行も保持する

#### Scenario: 起動時の読み込みと公開型
- **WHEN** core と trace の入口から静的な import をたどり、従来の公開元の型・定数を利用する
- **THEN** zod を静的に読む経路がなく、新旧の型を明示した利用側がコンパイルできる

### Requirement: 証拠とレポートの JSON Schema の生成と公開
core は Evidence と Report の JSON Schema をそれぞれ `schema/evidence.schema.json`・`schema/report.schema.json` に Zod から生成し、通常と publishConfig の exports で公開する SHALL。生成結果と配布ファイルの不一致を CI の試験で検出する MUST。JSON Schema は構造スキーマと同じ必須・任意の区別と未知フィールドの許可を表す SHALL。verify・evidenceの現行公開JSON Schemaは新形式へ更新する SHALL。R-C001-09のA候補として、旧版JSON Schemaも版付きパスとexportsで公開し、旧fixtureと履歴用スキーマを保持する SHALL。report・quality・trace・spec・tasks・quality-reportのJSON Schemaは変更しない MUST。

Source: REQ-304

#### Scenario: 生成結果と公開物の一致
- **WHEN** 2 種類の JSON Schema を生成して配布ファイルと照合し、配布された core の公開入口から読む
- **THEN** 内容が一致し、証拠とレポートの同じ有効・無効入力を検証できる

#### Scenario: 既存 JSON Schema の保持
- **WHEN** スキーマを再生成する
- **THEN** report・quality・trace・spec・tasks・quality-reportの6ファイルは変わらず、verify・evidenceは新形式と一致し旧版fixtureも保持される

### Requirement: verify 結果の未知のフィールド
core の現行verify 2.0.0と履歴verify 1.0.0のZodスキーマは、定義していないフィールドを拒否せず値を保持する SHALL。2.0.0で明示的に禁止された既知キーは拒否する MUST。

Source: REQ-275

#### Scenario: 未知のフィールドを残す
- **WHEN** 履歴1.0.0の最上位と `results`、および現行2.0.0の最上位と `checks` の要素に、定義していないフィールドを持つverify結果を解析する
- **THEN** 解析は成功し、解析結果に同じフィールドが同じ値で残っている

### Requirement: JSON Schema の書き出し
core が公開する `schema/verify-result.schema.json` は、verify 結果の Zod スキーマから `z.toJSONSchema()` で書き出した内容と一致する MUST。core は Zod スキーマからこのファイルを書き出すコマンドを提供する SHALL。ファイルと書き出した内容が違うときは、CI で動くテストが失敗する MUST。現行パスは2.0.0を表し、R-C001-09のA候補では履歴1.0.0も版付きパスとexportsで公開して同様に再生成一致を検査する SHALL。

Source: REQ-276

#### Scenario: 書き出した内容とファイルが一致する
- **WHEN** Zod スキーマから JSON Schema を書き出し、`packages/core/schema/` のファイルと比べる
- **THEN** 内容が一致する

#### Scenario: 書き出しのコマンドでファイルを作り直せる
- **WHEN** core の書き出しのコマンドを実行する
- **THEN** `packages/core/schema/verify-result.schema.json` が、Zod スキーマから書き出した内容になる

### Requirement: 品質判定の共有4値

core は `PASS`・`FAIL`・`INSUFFICIENT_EVIDENCE`・`NOT_APPLICABLE` のみを受け付ける Zod enum と、そのスキーマから導出した `QualityResult` 型を公開する SHALL。スキーマは `loadQualityResultSchema()` で遅延ロードし、core・kit・CLI の入口から zod を静的に読み込まない MUST。現行VerifyResultは2.0.0、Evidenceは2へ移し、履歴1.0.0の型・fixtureを保持する MUST。report・quality・trace・spec・tasks・quality-reportの6本のJSON Schemaを変えない MUST。旧verify・evidenceのJSON Schema公開継続はR-C001-09の候補に従う。共有 enum 単独の JSON ファイルは追加しない。

Source: REQ-305

#### Scenario: 4値の読み取り
- **WHEN** 遅延 loader で取得した `qualityResultSchema` に4値をそれぞれ渡す
- **THEN** 値をそのまま返し、それ以外の値・型を拒否する

#### Scenario: 公開型と既存形式
- **WHEN** core の公開型と loader を配布物から利用する
- **THEN** `QualityResult` はスキーマから導出され、現行verify 2.0.0と履歴1.0.0を区別でき、無関係の6本のJSONは変わらない

### Requirement: 未知キーをプロトタイプを変えずに保持する

core の verify 結果、Markdown 解析結果、quality.yaml、quality-report、証拠とリリースレポートの公開スキーマは、未知の own property `__proto__`・`constructor`・`prototype` を通常の未知キーと同じく値を変えず解析結果に保持する SHALL。最上位とスキーマが検証する入れ子・配列要素に同じ規則を適用する MUST。入力と共有プロトタイプを変更せず、`__proto__` を出力のプロトタイプ変更として解釈しない MUST。既知項目の検証・既定値、現行と履歴の導出型・遅延ロードを維持する MUST。verify・evidenceの現行JSON Schemaだけをv2へ更新し、無関係の6種類の内容を維持する MUST。

Source: REQ-307

#### Scenario: 最上位の未知キーを保持する
- **WHEN** 必須項目に加え、JSON の own property として `__proto__`・`constructor`・`prototype` を持つ値を公開スキーマで解析する
- **THEN** parse と safeParse は成功し、各キーが同じ値の own property として解析結果に残る

#### Scenario: 検証する入れ子と配列要素のキーを保持する
- **WHEN** 現行verifyのchecksと履歴verifyのresults、Markdown の各解析行、quality.yaml の検証対象の入れ子、版に対応する証拠内のverify・checks/results・documents、レポート内の evidence・attention・rows・questions・assumptions に未知の `__proto__` を持つ値を解析する
- **THEN** 各階層の同じキーと値が解析結果に残り、未知キーの値の入れ子も変わらない

#### Scenario: 入力とプロトタイプを変更しない
- **WHEN** `__proto__` の値にオブジェクト・配列・null・プリミティブを指定して解析する
- **THEN** 入力は変わらず、解析結果はそのキーを own property として持ち、共有プロトタイプと解析結果の通常のプロトタイプは変更されない

#### Scenario: 既知項目の検証と既定値を保つ
- **WHEN** 未知キーを含む正常入力、必須項目の欠落、不正な版、省略可能な既定値を持つ入力を解析する
- **THEN** 従来と同じ受理・拒否と既定値が得られ、非同期の解析でも未知キーが保持される

#### Scenario: 配布スキーマと遅延ロードを保つ
- **WHEN** 対象スキーマから JSON Schema を生成し、公開 loader と core・CLI の入口を検査する
- **THEN** 配布JSONが版別スキーマと一致し、無関係の6種類の内容と公開する導出型が維持され、core・CLI の静的な入口から zod が読み込まれない

## ADDED Requirements

### Requirement: verify 2.0.0の状態とscope
coreは要件定義7.3の `schemaVersion: 2.0.0` のZodスキーマと導出型を公開する SHALL。ci/local各completed・partialとabortedを区別し、ciにはchecks・summary・decision・verdict、localにはchecks・summary・decisionとsummary.pendingを持たせverdictを持たせない MUST。completed/partialでは既存の成功テスト対応coverageを任意に保持する SHALL。abortedはchange・run.errorsを持ち、scope・checks・summary・decision・verdictを持たない MUST。全objectの未知キーは拒否せず値を保持し、既知の禁止キーは拒否する MUST。スキーマは遅延ロードする SHALL。

Source: REQ-308

#### Scenario: completedとabortedの最小契約
- **WHEN** ci/localのcompletedとabortedの2.0.0を解析する
- **THEN** 各必須項目を検査し、abortedのchecks・summary・decision・verdictとlocalのverdictを拒否する

#### Scenario: partialの構造と未完了範囲
- **WHEN** ci/localのpartialを解析する
- **THEN** ci/localに応じた必須項目を受け付け、localのverdictとaborted専用の形を区別する

#### Scenario: 未知キーと公開型
- **WHEN** 各object階層へ `__proto__` を含む未知キーを渡し、配布物の型とloaderを利用する
- **THEN** 未知値を保持し、公開型がスキーマと一致し、入口からzodを静的に読まない

### Requirement: verifyの実行エラー
verifyの `run.errors` は種別 `usage/config/permission/tool/network/runtime`、対象target、日本語message、次の操作nextを持つ SHALL。change未確定時はchangeをnullとし、生の入力をエラーの対象へ残す MUST。usage/configのabortedは2、ほかのabortedは3に対応させる MUST。abortedを品質のFAILとして扱わない MUST。

Source: REQ-309

#### Scenario: changeが確定しない
- **WHEN** change必須ゲートでchange値欠落・構文が不正なIDを指定する
- **THEN** change:nullのabortedとusageエラー、元の入力、次の操作を返す。bare verifyへの適用はR-C001-01の回答後に確定する。構文が有効で存在しないchangeはこのusage分類へ含めず、REQ-055の存在検査FAIL/1を保持する

#### Scenario: 不正設定と読取失敗
- **WHEN** 設定の構文・型・対応版が不正、または権限等で読取不能になる
- **THEN** 前者をconfig、後者をpermission/runtimeのabortedとして区別する
