## ADDED Requirements

### Requirement: OS によらないテストの前提
リポジトリのテストとテスト用のスクリプトは、ubuntu-latest・macos-latest・windows-latest で同じ期待値を使う SHALL。OS の違いは期待値を変えず、skip もせずに、テストの準備と読み方で吸収する MUST。行の正規表現で読むファイルは、改行を LF にそろえてから読む MUST。リンク先のないシンボリックリンクを `.git/hooks` に置くときは、git がフックとして実行しない名前にする MUST。Windows でシェルから起動するとき、固定の裸のコマンド名 `pnpm`・`npm` は引用符で囲まず、空白を含みうる実行パスと引数は囲む MUST。準備の時間が OS で変わる非同期の待ちには、待ち時間を明示する MUST。

Source: REQ-236

#### Scenario: CRLF で取り出したワークフロー
- **WHEN** Windows でワークフローの YAML が CRLF で取り出され、公開経路の権限と CodeQL のワークフローの検査を実行する
- **THEN** 改行を LF にそろえてから読み、LF のときと同じ期待値で検査する

#### Scenario: リンク先のないリンクを置いたフックのディレクトリ
- **WHEN** リンク先のないシンボリックリンクを `.git/hooks` に置いて、テストの準備のコミットをする
- **THEN** git はそのリンクを実行せず、run の git の設定とフックの比較まで進む

#### Scenario: 配布物の準備のコマンド
- **WHEN** Windows で配布物の試験のスクリプトが `pnpm` か `npm` を起動する
- **THEN** コマンド名を引用符で囲まずに起動し、引数と、`.cmd` で終わる実行パスは引用符で囲む

#### Scenario: 二重起動の待ち
- **WHEN** Windows で run の開始からエンジンの起動までに 1 秒以上かかる
- **THEN** 二重起動の検査は明示した待ち時間のうちに先の実行のエンジンの起動を待ってから、二重起動を試す
