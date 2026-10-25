## RENAMED Requirements

- FROM: `### Requirement: 要件ごとの検収の表`
- TO: `### Requirement: 要件ごとの結果の表`

## MODIFIED Requirements

### Requirement: 要件ごとの結果の表
`loomake trace report --change <id>` は、`.loomake/evidence/<change-id>/` のいちばん新しい記録を使い、その記録に保存した trace.md の要件台帳の要件ごとに、出典・状態・対応する Requirement・テストファイル・最後の検査結果を 1 行に並べた表を、リリースレポートとして出力する SHALL。Markdown のレポートの題は「リリースレポート」、要件ごとの表の見出しは「要件ごとの結果」とする SHALL。対応する Requirement は、その記録に保存した差分仕様で、その要件を `Source:` に持つ Requirement の名前とする SHALL。テストファイルと最後の検査結果は、同じ記録から取る SHALL。記録に文書が保存されていないときの扱いは、「古い形式の証拠の記録」に従う SHALL。change は進行中の change から探し、なければ archive から探す SHALL。change-id が OpenSpec の change 名の形でないときと、`archive` のときは、使い方の誤りとして終了コード 2 を返す SHALL。

Source: REQ-070

#### Scenario: 要件の行が並ぶ
- **WHEN** REQ-070 を `Source:` に持つ Requirement「表の出力」があり、証拠の記録で REQ-070 に tests/report.test.ts が挙がっている change に `loomake trace report --change c1` を実行する
- **THEN** 表に REQ-070 の行があり、出典・状態・「表の出力」・tests/report.test.ts・最後の検査結果が並ぶ

#### Scenario: レポートの題と表の見出し
- **WHEN** `loomake trace report --change c1` を Markdown で実行する
- **THEN** 題が「リリースレポート：c1」、要件ごとの表の見出しが「要件ごとの結果」で、「検収」の語はレポートに出ない

#### Scenario: いちばん新しい記録を使う
- **WHEN** 記録した日時の違う記録が 2 つある change に `loomake trace report` を実行する
- **THEN** 新しいほうの記録のテストファイルと検査結果が使われる

#### Scenario: archive した change
- **WHEN** `archive/2026-10-23-c1` にある change c1 に `loomake trace report --change c1` を実行する
- **THEN** archive の change の証拠の記録からレポートが作られる

#### Scenario: 証拠の記録がない
- **WHEN** `.loomake/evidence/c1/` に記録がない change に `loomake trace report --change c1` を実行する
- **THEN** `loomake trace record` を先に実行するよう日本語で案内し、終了コードは 1 である

#### Scenario: パスの区切りを含む change-id
- **WHEN** `loomake trace report --change ../c1` を実行する
- **THEN** change-id にパスの区切りを含められないと日本語で表示され、終了コードは 2 である

#### Scenario: 記録のあとで要約を変える
- **WHEN** 証拠を記録したあとで、trace.md の REQ-070 の要約を書き換えて `loomake trace report --change c1` を実行する
- **THEN** 表の REQ-070 の要約は記録したときの要約で、書き換えたあとの要約は表に載らない

### Requirement: 範囲外と既存仕様で充足の要件
要件ごとの結果の表は、状態が「範囲外」と「既存仕様で充足」の要件も、状態を付けて含める SHALL。

Source: REQ-071

#### Scenario: 範囲外の要件
- **WHEN** 状態が範囲外の REQ-075 を持つ change に `loomake trace report` を実行する
- **THEN** 表に REQ-075 の行があり、状態に「範囲外」と書かれている

#### Scenario: 既存仕様で充足の要件
- **WHEN** 状態が既存仕様で充足の要件を持つ change に `loomake trace report` を実行する
- **THEN** 表にその要件の行があり、状態に「既存仕様で充足」と書かれている

### Requirement: 確認事項の一覧
レポートは、確認事項ごとに ID・質問・回答・回答者・回答日を一覧にする SHALL。

Source: REQ-077

#### Scenario: 確認事項が並ぶ
- **WHEN** 回答者が「プロダクト責任者」、回答日が 2026-10-23 の Q-01 を持つ change のレポートを作る
- **THEN** 確認事項の一覧に Q-01 の質問・回答・「プロダクト責任者」・2026-10-23 が並ぶ

### Requirement: 検査の範囲の説明
レポートは、「自動検査は、要件 ID を含む成功したテストの存在を確認しています。テスト内容の妥当性と、要件を満たしているかの判断にはレビューが必要です。」という説明を、要件ごとの結果の表より前に載せる SHALL。

Source: REQ-131

#### Scenario: 説明が載る
- **WHEN** `loomake trace report --change c1` を実行する
- **THEN** 要件ごとの結果の表より前に、検査の範囲の説明が載る
