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

### Requirement: trace report の実行時依存
trace report を含む `@loomake/trace` の実行時依存は `@loomake/core` と `@loomake/kit` のみとする SHALL。

Source: REQ-083

#### Scenario: trace の依存
- **WHEN** `packages/trace/package.json` の `dependencies` を読む
- **THEN** `@loomake/core` と `@loomake/kit` 以外が含まれない

### Requirement: 冒頭の要注意の一覧
レポートの冒頭に、状態が反映済で、使った証拠の記録の中に合格したテストのない要件と、状態が確認待ちの要件を、それぞれ一覧で示す SHALL。テストがない要件と、テストが不合格だった要件は分けずに、「合格したテストのない要件」として 1 つにまとめる SHALL。どちらもないときは、ないことを示す SHALL。

Source: REQ-072

#### Scenario: 合格したテストのない要件がある
- **WHEN** 反映済の REQ-070 に、証拠の記録の中で合格したテストがない change のレポートを作る
- **THEN** 冒頭の「合格したテストのない要件」の一覧に REQ-070 が挙がる

#### Scenario: 確認待ちの要件がある
- **WHEN** 状態が確認待ちの REQ-072 を持つ change のレポートを作る
- **THEN** 冒頭の「確認待ちの要件」の一覧に REQ-072 が挙がる

#### Scenario: どちらもない
- **WHEN** 反映済の要件すべてに合格したテストがあり、確認待ちの要件がない change のレポートを作る
- **THEN** 冒頭に、要注意の要件がないことが書かれる

### Requirement: 確認事項の一覧
レポートは、確認事項ごとに ID・質問・回答・回答者・回答日を一覧にする SHALL。

Source: REQ-077

#### Scenario: 確認事項が並ぶ
- **WHEN** 回答者が「顧客 PM」、回答日が 2026-10-23 の Q-01 を持つ change のレポートを作る
- **THEN** 確認事項の一覧に Q-01 の質問・回答・「顧客 PM」・2026-10-23 が並ぶ

### Requirement: 仮定の一覧
レポートは、仮定ごとに ID・内容・承認者・承認日を一覧にする SHALL。

Source: REQ-078

#### Scenario: 仮定が並ぶ
- **WHEN** 承認者が「開発リーダー」、承認日が 2026-10-23 の A-01 を持つ change のレポートを作る
- **THEN** 仮定の一覧に A-01 の内容・「開発リーダー」・2026-10-23 が並ぶ

### Requirement: 合意の欄が空のときの警告
回答のある確認事項で回答者か回答日が空のとき、または承認欄のある仮定で承認者か承認日が空のとき、レポートはその ID と空の欄を警告として示す SHALL。回答も承認もまだない行は、この警告の対象にしない SHALL。

Source: REQ-079

#### Scenario: 回答者が空
- **WHEN** 回答はあるが回答者が空の Q-02 を持つ change のレポートを作る
- **THEN** Q-02 の回答者が空であることが警告として示される

#### Scenario: 列のない古い trace.md
- **WHEN** 回答者・回答日の列がない trace.md で、回答のある Q-01 を持つ change のレポートを作る
- **THEN** レポートは作られ、Q-01 の回答者と回答日が空であることが警告として示される

#### Scenario: 未回答の行
- **WHEN** 回答が空の Q-03 を持つ change のレポートを作る
- **THEN** Q-03 は回答者・回答日の警告の対象にならない

### Requirement: report の性能
要件 500 件の change のレポートを、`loomake trace report` は 5 秒以内に出力する SHALL。

Source: REQ-086

#### Scenario: 大きな change
- **WHEN** 要件 500 件と、その証拠の記録を持つ見本の change に `loomake trace report` を実行する
- **THEN** 5 秒以内に出力が終わる
