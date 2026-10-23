## ADDED Requirements

### Requirement: 要件ごとの検収の表
`loomake trace report --change <id>` は、その change の trace.md の要件台帳の要件ごとに、出典・状態・対応する Requirement・テストファイル・最後の検査結果を 1 行に並べた表を出力する SHALL。対応する Requirement は、その change の差分仕様で、その要件を `Source:` に持つ Requirement の名前とする SHALL。テストファイルと最後の検査結果は、`.loomake/evidence/<change-id>/` のいちばん新しい記録から取る SHALL。change は進行中の change から探し、なければ archive から探す SHALL。

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

### Requirement: 範囲外と既存仕様で充足の要件
検収の表は、状態が「範囲外」と「既存仕様で充足」の要件も、状態を付けて含める SHALL。

Source: REQ-071

#### Scenario: 範囲外の要件
- **WHEN** 状態が範囲外の REQ-075 を持つ change に `loomake trace report` を実行する
- **THEN** 表に REQ-075 の行があり、状態に「範囲外」と書かれている

#### Scenario: 既存仕様で充足の要件
- **WHEN** 状態が既存仕様で充足の要件を持つ change に `loomake trace report` を実行する
- **THEN** 表にその要件の行があり、状態に「既存仕様で充足」と書かれている

### Requirement: 使った証拠の記載
レポートは、使った証拠の記録の、記録した日時・検査したコミットの SHA・コミットの日時を記載する SHALL。

Source: REQ-073

#### Scenario: 記録の情報が載る
- **WHEN** SHA が `0123456789ab…` の記録を使って `loomake trace report` を実行する
- **THEN** レポートに、その記録の記録した日時・SHA・コミットの日時が載る

### Requirement: 出力の形式
`loomake trace report` は、`--format md` で Markdown を、`--format json` で JSON を標準出力に出す SHALL。`--format` を省いたときは Markdown にする SHALL。`--format html` を指定したときは、HTML は次の版で対応する旨を日本語で表示し、終了コード 2 を返す SHALL。

Source: REQ-074

#### Scenario: Markdown で出す
- **WHEN** `loomake trace report --change c1 --format md` を実行する
- **THEN** Markdown の表を含むレポートが出力され、終了コードは 0 である

#### Scenario: JSON で出す
- **WHEN** `loomake trace report --change c1 --format json` を実行する
- **THEN** 要件ごとの行と使った証拠の記録を含む JSON が出力される

#### Scenario: HTML はまだ出せない
- **WHEN** `loomake trace report --change c1 --format html` を実行する
- **THEN** HTML は次の版で対応する旨が表示され、終了コードは 2 である

### Requirement: 同じ入力からは同じレポート
同じ trace.md・差分仕様・証拠の記録からは、`loomake trace report` は毎回同じ内容を出力する SHALL。レポートには作った日時を入れず、表の行は REQ の番号順に並べる SHALL。

Source: REQ-085

#### Scenario: 2 回出力する
- **WHEN** 入力を変えずに、時刻を変えて `loomake trace report` を 2 回実行する
- **THEN** 2 回の出力は 1 文字も違わない

### Requirement: オフラインでの動作
`loomake trace report` は、ネットワークに接続せずに動く SHALL。

Source: REQ-084

#### Scenario: ネットワークがない
- **WHEN** ネットワークに接続できない状態で `loomake trace report --change c1` を実行する
- **THEN** レポートが出力される

### Requirement: 日本語のレポート
`loomake trace report` が出すレポートの見出し・列名・説明とメッセージは、日本語で書かれている SHALL。

Source: REQ-088

#### Scenario: 見出しが日本語
- **WHEN** `loomake trace report --change c1` を実行する
- **THEN** レポートの見出しと表の列名は日本語である

### Requirement: 動作環境
`loomake trace report` は、Node.js 20.19 以上で動作する SHALL。

Source: REQ-089

#### Scenario: Node.js 20.19 で動く
- **WHEN** Node.js 20.19 の環境で trace report のテストを実行する
- **THEN** テストが合格する
