## MODIFIED Requirements

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
