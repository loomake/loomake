## MODIFIED Requirements

### Requirement: 要件ごとの検収の表
`loomake trace report --change <id>` は、その change の trace.md の要件台帳の要件ごとに、出典・状態・対応する Requirement・テストファイル・最後の検査結果を 1 行に並べた表を出力する SHALL。対応する Requirement は、その change の差分仕様で、その要件を `Source:` に持つ Requirement の名前とする SHALL。テストファイルと最後の検査結果は、`.loomake/evidence/<change-id>/` のいちばん新しい記録から取る SHALL。change は進行中の change から探し、なければ archive から探す SHALL。change-id に `/`・`\`・`..` を含むときは、使い方の誤りとして終了コード 2 を返す SHALL。

Source: REQ-070

#### Scenario: 要件の行が並ぶ
- **WHEN** REQ-070 を `Source:` に持つ Requirement「表の出力」があり、証拠の記録で REQ-070 に tests/report.test.ts が挙がっている change に `loomake trace report --change c1` を実行する
- **THEN** 表に REQ-070 の行があり、出典・状態・「表の出力」・tests/report.test.ts・最後の検査結果が並ぶ

#### Scenario: いちばん新しい記録を使う
- **WHEN** 記録した日時の違う記録が 2 つある change に `loomake trace report` を実行する
- **THEN** 新しいほうの記録のテストファイルと検査結果が使われる

#### Scenario: archive した change
- **WHEN** `archive/2026-10-23-c1` にある change c1 に `loomake trace report --change c1` を実行する
- **THEN** archive の trace.md と差分仕様からレポートが作られる

#### Scenario: 証拠の記録がない
- **WHEN** `.loomake/evidence/c1/` に記録がない change に `loomake trace report --change c1` を実行する
- **THEN** `loomake trace record` を先に実行するよう日本語で案内し、終了コードは 1 である

#### Scenario: パスの区切りを含む change-id
- **WHEN** `loomake trace report --change ../c1` を実行する
- **THEN** change-id にパスの区切りを含められないと日本語で表示され、終了コードは 2 である

### Requirement: 使った証拠の記載
レポートは、使った証拠の記録の、記録した日時・検査したコミットの SHA・コミットの日時を記載する SHALL。証拠の記録に JSON として読めないファイルがあるときは、そのファイルのパスを日本語で示し、使い方の誤りとして終了コード 2 を返す SHALL。

Source: REQ-073

#### Scenario: 記録の情報が載る
- **WHEN** SHA が `0123456789ab…` の記録を使って `loomake trace report` を実行する
- **THEN** レポートに、その記録の記録した日時・SHA・コミットの日時が載る

#### Scenario: 読めない記録がある
- **WHEN** `.loomake/evidence/c1/` に JSON として壊れたファイルがある change に `loomake trace report --change c1` を実行する
- **THEN** そのファイルのパスと、読めないことが日本語で表示され、スタックトレースは出ず、終了コードは 2 である
