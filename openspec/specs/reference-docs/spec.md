# reference-docs Specification

## Purpose

利用者がquality.yamlの現行の設定項目と制約を調べられるように、スキーマからリファレンスを生成する契約を定める。手書きの項目一覧に依存せず、全階層・条件付き必須・既定値と、再生成時の一致を保つ。

## Requirements

### Requirement: quality.yamlの全構造のリファレンス
quality.yamlのリファレンスは、coreの現行スキーマを元に生成する SHALL。トップレベル、objectの子、IDをキーにするrecordの値、配列要素と各分岐の全項目を含め、パス・型・必須/任意・条件付き必須・既定値・enum/const・数値/文字列/キーの制約・既存descriptionを表示する MUST。NA分岐を区別し、スキーマにない既定値やmetric/sourceの解釈を追加しない MUST。説明がない項目は未記載と示す SHALL。

Source: REQ-320

#### Scenario: 全階層と制約
- **WHEN** 現行のqualityスキーマからリファレンスを生成する
- **THEN** version/model、defaults、report、objectivesとproductの項目・evidence/indicators配列、automation、証跡保管方針の全階層と、IDキー・期間・target・数値の制約を含む

#### Scenario: 対象外の条件付き必須
- **WHEN** objectivesとproductのapplicable分岐とnot_applicable分岐を生成する
- **THEN** characteristicの共通必須と、NAのときだけreason/confirmed_byが必須になる条件を区別し、任意項目を無条件の必須にしない

#### Scenario: 入力省略と補完
- **WHEN** evidence/indicatorsの空配列、objectives/productの空object、証跡保管方針の既定値を表示する
- **THEN** 入力時の省略可否とdefault注記を区別し、証跡保管方針の親を省略したとき子の既定値が適用されることを示す。defaultのない任意項目へ値を補わない

### Requirement: 再生成一致と読み取り専用の検査
同じスキーマからは同じリファレンスを生成する SHALL。生成物に時刻・実行環境固有のパスを入れず、順序を安定させる MUST。checkモードは生成物と期待内容を照合し、一致時は0、欠落・改変・読取/生成失敗時は非0で終了する SHALL。checkモードで生成物を作成・上書きしてはならない MUST NOT。CIでも再生成不一致を失敗として検出する MUST。

Source: REQ-321

#### Scenario: 同じ入力と差分なし
- **WHEN** 同じ入力で生成を繰り返し、checkモードで照合する
- **THEN** 出力は同一になり、checkは0で終了する。checkout時のLF/CRLFの違いだけは同一内容と扱う

#### Scenario: 欠落と改変
- **WHEN** 生成物がない、または1項目・既定値・分岐の説明を改変してcheckを実行する
- **THEN** 非0となり対象ファイルと再生成方法を示す。欠落ファイルを作成せず、改変内容を上書きしない

#### Scenario: スキーマとのずれ
- **WHEN** スキーマの項目・制約・既定値・分岐を変更して生成物を更新しない
- **THEN** 既存のスキーマ生成一致検査とリファレンス一致検査によりCIが失敗し、古い説明を正しいものとして通さない

#### Scenario: リンクを含むパスからの直接起動
- **WHEN** 実体のディレクトリ、親ディレクトリのシンボリックリンク、またはWindowsのjunctionを通るパスでqualityリファレンス生成器を直接起動する
- **THEN** cwdに依存せず同じ生成先を扱い、欠落checkは1、不明引数は2、通常生成と一致checkは0で終了する。欠落checkと不明引数では生成せず、改変checkは1で終了して内容を上書きしない

#### Scenario: importによる読み込み
- **WHEN** qualityリファレンス生成器を別のモジュールからimportする
- **THEN** 生成・照合や診断出力を行わず、呼び出し元の終了コードを変更しない

### Requirement: 生成ページの導線と既存契約の保持
生成ページはdocs/guide/3.referenceに置き、空でないtitle/descriptionと生成元・再生成方法を持ち、guideの入口からリンクできる SHALL。既存のリファレンスとリンクを保持し、CLI・quality.yamlの受理/補完・公開8 JSON・公開型/exports・実行時依存・判定を変更しない MUST。CLIリファレンス生成とC-001の未決契約は本範囲へ含めない MUST。スキーマの文字列はMarkdown/HTMLの構文として実行されない形で表示する SHALL。

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

### Requirement: 現行CLIの全コマンドとオプションのリファレンス
CLIのリファレンスは、CLIと共通の定義から生成する SHALL。全コマンド・操作・各コマンドが受け付けるオプションについて、構文・説明・値を取るかどうか・必須/任意・組合せ条件・既定値・受理値と環境条件を表示する MUST。共通のhelp/version操作も含め、現在のCLIにない引数や未確定のv2契約を追加しない MUST。

Source: REQ-323

#### Scenario: コマンドと操作の列挙
- **WHEN** 現行の定義からCLIリファレンスを生成する
- **THEN** init・verify・trace・run・doctorと、traceのrecord・report・answer・approveを列挙し、各操作のオプションを区別する。doctorに固有オプションがないことも示す

#### Scenario: 必須条件と省略時の振る舞い
- **WHEN** 各オプションの必須性・条件・既定値を表示する
- **THEN** verifyのchangeとゲートの相互条件、reportのmd、runのclaude-code、answer/approveの日付省略時のローカル日付、flag省略時のfalseとskip-permissionsの環境条件を示す。必須の値へ架空の既定値を付けない

#### Scenario: 共通操作と境界
- **WHEN** help・versionと値の指定方法を読む
- **THEN** -h/--help、先頭の-v/--version、値付きオプションの空白/等号構文が分かる。helpとversionを各コマンドが通常受理する固有オプションにせず、C-001のv2出力・scope・証拠採否を含めない

### Requirement: 共通定義への集約で既存CLIを保つ
リファレンスとCLIは同じコマンド・オプション定義を使用する SHALL。集約により、受理/拒否、値の扱い、必須条件・既定値、helpの優先、usage・helpの全文と表示順、打ち間違いの候補とその順序、日本語の診断と発生順・終了コードを変更しない MUST。公開型・exports・実行時依存と既存8種類のJSON Schemaも変更しない MUST。

Source: REQ-324

#### Scenario: ヘルプとusageの保持
- **WHEN** 全体・各コマンド・traceの各操作でhelpを表示し、使い方の誤りを起こす
- **THEN** 基準mainの全文・空白・改行・順序と同じhelp/usageを返す。helpは業務処理より優先し、traceのconstructor/toStringに対しても全体helpを安全に表示する

#### Scenario: 解析と候補順の保持
- **WHEN** 空白/等号構文、空値、反復オプション、flagへの等号指定、未知のコマンド/オプション、同距離の候補を含む引数を解析する
- **THEN** 従来と同じ値・拒否・候補・診断を返す。値付きオプションの反復は最後の値を採り、表示順と解析候補順が異なる場合もそれぞれの順序を保つ

#### Scenario: handlerの条件と診断の保持
- **WHEN** verifyの不正な組合せ、reportの不正形式、answer/approveの必須値不足・不正日付、runの省略値と環境条件を検査する
- **THEN** 従来の検査結果・既定値・診断の優先順を保ち、定義の注記を理由に新しい拒否や補完を加えない

### Requirement: CLIページの生成一致と安全な導線
CLIページはdocs/guide/3.referenceに置き、空でないtitle/description、生成元と再生成方法を持ち、guideの入口からたどれる SHALL。同じ定義から決定的に生成し、読み取り専用checkは一致時0、欠落・改変・読取/生成失敗時は非0とし、CIでも不一致を検出する MUST。checkで修復せず、対象外の文書を変更しない MUST。文字列をMarkdown/HTMLの構文として実行せず表示する SHALL。

Source: REQ-325

#### Scenario: 再生成とcheck
- **WHEN** 同じ定義で繰り返し生成し、生成済みページをcheckする
- **THEN** 時刻や環境固有のパスを含まない同じ出力となり、checkは0になる。LF/CRLFだけの違いは同一内容とする

#### Scenario: 不一致と失敗の検出
- **WHEN** 定義を変えてページを更新しない、ページが欠落/改変している、または読取/生成に失敗する
- **THEN** checkとCIの対応する検査は失敗し、日本語で対象と再生成方法を示す。checkは欠落ファイルを作成せず、既存ファイルを上書きしない

#### Scenario: 導線と文字列
- **WHEN** guideからCLIページへ移動し、区切り文字・改行・HTML記号を含む定義を表示する
- **THEN** ページの表や構造を壊さず文字列として読め、既存のqualityページと他のリファレンスの内容・リンクも保たれる

#### Scenario: 別名の親ディレクトリからの起動
- **WHEN** 実パス、親ディレクトリのsymlink、またはWindows junctionを経由して生成器を直接起動する
- **THEN** 同じ入口として実行し、有効な定義と書出し先での生成と一致checkは0、欠落・改変のcheckは1を返す。checkは読み取り専用を保ち、実処理を通らず成功した扱いにしない

#### Scenario: 不正引数とimportの副作用
- **WHEN** どの起動経路でも不明引数・未対応の引数の組合せを渡す、または生成器をimportするだけにする
- **THEN** 不正引数は2と日本語のusageを返してファイルを作成・変更しない。importだけでは生成/check・引数検査を実行せず、標準出力・標準エラー・ファイルへの副作用を起こさない
