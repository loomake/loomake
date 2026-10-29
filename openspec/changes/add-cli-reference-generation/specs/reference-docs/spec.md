## ADDED Requirements

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
