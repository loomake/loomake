## ADDED Requirements

### Requirement: テストのレポートの安全な相対パス
`tests.report` は、プロジェクトの root 内のファイルを指す相対パスに限る SHALL。読み込み時にバックスラッシュを `/` へ変え、空と `.` の途中の要素を除き、すべての利用側で正規化した値を使う SHALL。空・文字列でない値、制御文字、絶対パスとドライブ指定、`..` の要素、末尾の区切り、最後が `.` の値を UsageError とする SHALL。明示値・既定値とも設定を読むときと report を消す直前に、root 外やリンク先のないリンク、通常のファイルでない対象、途中の通常のディレクトリでない要素を拒否し、何も消さない MUST。最後の要素が root 内を指す安全なリンクなら、消すのはリンクだけとする SHALL。

Source: REQ-424

#### Scenario: root の外を指す設定
- **WHEN** report が `../outside.json`、絶対パス、またはリンクを通って root の外を指す
- **THEN** 設定の誤りとして日本語で対象を示し、CLI は終了コード 2、JSON は config の aborted とし、外のファイルを変更しない

#### Scenario: 設定を省略した既定値の外部リンク
- **WHEN** config がないか tests.report を省略し、`.loomake` が root の外を指すリンクである
- **THEN** 設定の読み込みでも拒否し、外の test-report.json を消さない

#### Scenario: ディレクトリと壊れたリンク
- **WHEN** report の対象がディレクトリ、通常のファイル以外、リンク先のないリンク、または途中の要素がファイルである
- **THEN** 変更前に UsageError で止め、stack を表示せず、既存の内容を保つ

#### Scenario: 形の誤ったパス
- **WHEN** report に制御文字、`..` 要素、ドライブ指定、末尾の区切り、または最後の `.` を含む値を設定する
- **THEN** 外部操作より前に UsageError にし、空・数値の既存の診断は維持する

#### Scenario: 冗長な区切りを正規化する
- **WHEN** `a//b.json`、`./a/./b.json`、またはバックスラッシュ区切りで report を設定する
- **THEN** すべて `a/b.json` として検査・削除・読み込み・除外判定に使う

#### Scenario: 検査のあとで対象が置き換わる
- **WHEN** 仕様の外部検査のあと report の親が root 外へのリンクやディレクトリに変わる
- **THEN** 削除直前の検査で UsageError とし、置換後の内容を消さない

#### Scenario: 安全な最終リンク
- **WHEN** report の最後の要素が root 内の通常のファイルを指すリンクである
- **THEN** 対象のファイルを消さず、リンクだけを除去する
