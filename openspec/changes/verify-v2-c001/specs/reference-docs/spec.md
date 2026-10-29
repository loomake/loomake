## MODIFIED Requirements

### Requirement: 生成ページの導線と既存契約の保持
生成ページはdocs/guide/3.referenceに置き、空でないtitle/descriptionと生成元・再生成方法を持ち、guideの入口からリンクできる SHALL。生成/check単独では既存のリファレンスとリンクを保持し、CLI・quality.yamlの受理/補完・公開8 JSON・公開型/exports・実行時依存・判定を変更しない MUST。CLI生成・未決契約・他の形式改版は範囲外 MUST。スキーマの文字列はMarkdown/HTMLの構文として実行されない形で表示する SHALL。掲載先によらずquality.schema.jsonはhttps://github.com/loomake/loomake/blob/main/packages/core/schema/quality.schema.json、quality-schema.tsはhttps://github.com/loomake/loomake/blob/main/packages/core/src/quality-schema.tsへリンクする SHALL。

Source: REQ-322

#### Scenario: 入口と既存ページ
- **WHEN** guideの入口と生成ページを読む
- **THEN** qualityリファレンスへ到達でき、既存の互換性・資源予算・セキュリティのページへのリンクも残る。生成ページのtitle/descriptionは空でない

#### Scenario: 生成の影響範囲
- **WHEN** リファレンスの生成またはcheckを実行する
- **THEN** 生成対象以外の既存文書・公開JSON・製品ファイルを変更しない。metric/sourceを現行の文字列制約以上に制限した説明や、未実装のv2契約を生成しない

#### Scenario: 文字列の表示
- **WHEN** スキーマのdescriptionや値にMarkdownの区切り・改行・HTML記号が含まれる
- **THEN** 表の列や構造を壊さず、元の文字列として読める形で表示する

#### Scenario: GitHubとサイトでの生成元リンク
- **WHEN** 生成したqualityリファレンスをGitHubの文書ページまたは使い方サイトで読む
- **THEN** quality.schema.jsonとquality-schema.tsの生成元リンクが、それぞれ `https://github.com/loomake/loomake/blob/main/packages/core/schema/quality.schema.json` と `https://github.com/loomake/loomake/blob/main/packages/core/src/quality-schema.ts` を指す。両掲載先を基準に解決しても同じURLとなり、リポジトリ内にある対応する通常ファイルを参照する

### Requirement: 現行CLIの全コマンドとオプションのリファレンス
CLIのリファレンスは、CLIと共通の定義から生成する SHALL。全コマンド・操作・各コマンドが受け付けるオプションについて、構文・説明・値を取るかどうか・必須/任意・組合せ条件・既定値・受理値と環境条件を表示する MUST。共通のhelp/version操作も含め、CLIリファレンス生成単独の変更では現在のCLIにない引数や未確定の契約を追加しない MUST。形式やCLIを改版する別のchangeはその単独変更の対象外とし、承認後の共通定義に従って生成する SHALL。

Source: REQ-323

#### Scenario: コマンドと操作の列挙
- **WHEN** 現行の定義からCLIリファレンスを生成する
- **THEN** init・verify・trace・run・doctorと、traceのrecord・report・answer・approveを列挙し、各操作のオプションを区別する。doctorに固有オプションがないことも示す

#### Scenario: 必須条件と省略時の振る舞い
- **WHEN** 各オプションの必須性・条件・既定値を表示する
- **THEN** verifyのchangeとゲートの相互条件、reportのmd、runのclaude-code、answer/approveの日付省略時のローカル日付、flag省略時のfalseとskip-permissionsの環境条件を示す。必須の値へ架空の既定値を付けない

#### Scenario: 共通操作と境界
- **WHEN** help・versionと値の指定方法を読む
- **THEN** -h/--help、先頭の-v/--version、値付きオプションの空白/等号構文が分かる。helpとversionを各コマンドが通常受理する固有オプションにせず、生成処理だけで共通定義に存在しない出力・scope・証拠採否を追加しない

### Requirement: 共通定義への集約で既存CLIを保つ
リファレンスとCLIは同じコマンド・オプション定義を使用する SHALL。共通定義への集約単独の変更では、受理/拒否、値の扱い、必須条件・既定値、helpの優先、usage・helpの全文と表示順、打ち間違いの候補とその順序、日本語の診断と発生順・終了コードを変更しない MUST。その集約単独の変更では公開型・exports・実行時依存と既存8種類のJSON Schemaも変更しない MUST。形式やCLIを改版する別のchangeはこの単独変更の対象外とし、改版で変える受理/出力と基準の具体差分は別に承認する SHALL。

Source: REQ-324

#### Scenario: ヘルプとusageの保持
- **WHEN** CLI仕様を変えず共通定義への集約だけを行い、全体・各コマンド・traceの各操作でhelpを表示し、使い方の誤りを起こす
- **THEN** 基準mainの全文・空白・改行・順序と同じhelp/usageを返す。helpは業務処理より優先し、traceのconstructor/toStringに対しても全体helpを安全に表示する

#### Scenario: 解析と候補順の保持
- **WHEN** 集約単独の変更で空白/等号構文、空値、反復オプション、flagへの等号指定、未知のコマンド/オプション、同距離の候補を含む引数を解析する
- **THEN** 従来と同じ値・拒否・候補・診断を返す。値付きオプションの反復は最後の値を採り、表示順と解析候補順が異なる場合もそれぞれの順序を保つ

#### Scenario: handlerの条件と診断の保持
- **WHEN** 集約単独の変更でverifyの不正な組合せ、reportの不正形式、answer/approveの必須値不足・不正日付、runの省略値と環境条件を検査する
- **THEN** 従来の検査結果・既定値・診断の優先順を保ち、定義の注記を理由に新しい拒否や補完を加えない
