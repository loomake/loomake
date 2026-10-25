## ADDED Requirements

### Requirement: レポートを作る change の探し方
change は進行中の change から探し、なければ archive から探す SHALL。change-id が OpenSpec の change 名の形でないときと、`archive` のときは、使い方の誤りとして終了コード 2 を返す SHALL。

Source: REQ-213

#### Scenario: archive した change
- **WHEN** `archive/2026-10-23-c1` にある change c1 に `loomake trace report --change c1` を実行する
- **THEN** archive の change の証拠の記録からレポートが作られる

#### Scenario: パスの区切りを含む change-id
- **WHEN** `loomake trace report --change ../c1` を実行する
- **THEN** change-id にパスの区切りを含められないと日本語で表示され、終了コードは 2 である


### Requirement: 要件ごとの結果の表の出力
`loomake trace report --change <id>` は、`.loomake/evidence/<change-id>/` のいちばん新しい記録を使い、その記録に保存した trace.md の要件台帳の要件ごとに、出典・状態・対応する Requirement・テストファイル・最後の検査結果を 1 行に並べた表を、リリースレポートとして出力する SHALL。Markdown のレポートの題は「リリースレポート」、要件ごとの表の見出しは「要件ごとの結果」とし、題と見出しの固定文言に「検収」の語を使わない SHALL。証拠に保存した要約・質問・回答・仮定の原文は置き換えずに載せる SHALL。対応する Requirement は、その記録に保存した差分仕様で、その要件を `Source:` に持つ Requirement の名前とする SHALL。テストファイルと最後の検査結果は、同じ記録から取る SHALL。記録に文書が保存されていないときの扱いは、「古い形式の証拠の記録」に従う SHALL。

Source: REQ-070

#### Scenario: 要件の行が並ぶ
- **WHEN** REQ-070 を `Source:` に持つ Requirement「表の出力」があり、証拠の記録で REQ-070 に tests/report.test.ts が挙がっている change に `loomake trace report --change c1` を実行する
- **THEN** 表に REQ-070 の行があり、出典・状態・「表の出力」・tests/report.test.ts・最後の検査結果が並ぶ

#### Scenario: レポートの題と表の見出し
- **WHEN** 要約に「検収」の語を含む要件を持つ change に `loomake trace report --change c1` を Markdown で実行する
- **THEN** 題が「リリースレポート：c1」、要件ごとの表の見出しが「要件ごとの結果」で、題と見出しの固定文言に「検収」の語はなく、要約の「検収」は原文のまま表に載る

#### Scenario: いちばん新しい記録を使う
- **WHEN** 記録した日時の違う記録が 2 つある change に `loomake trace report` を実行する
- **THEN** 新しいほうの記録のテストファイルと検査結果が使われる

#### Scenario: 証拠の記録がない
- **WHEN** `.loomake/evidence/c1/` に記録がない change に `loomake trace report --change c1` を実行する
- **THEN** `loomake trace record` を先に実行するよう日本語で案内し、終了コードは 1 である

#### Scenario: 記録のあとで要約を変える
- **WHEN** 証拠を記録したあとで、trace.md の REQ-070 の要約を書き換えて `loomake trace report --change c1` を実行する
- **THEN** 表の REQ-070 の要約は記録したときの要約で、書き換えたあとの要約は表に載らない

## REMOVED Requirements

### Requirement: 要件ごとの結果の表
**Reason**: 本文が 500 文字を超え、`openspec validate --specs --strict` が不合格になる。change の探し方と change-id の検査の 2 文と、その Scenario を「レポートを作る change の探し方」に分け、残りを「要件ごとの結果の表の出力」に置き換える。MODIFIED では Scenario を移せないため、REMOVED と ADDED で行う。文は移すだけで、振る舞いは変えない
**Migration**: 「要件ごとの結果の表の出力」と「レポートを作る change の探し方」の Requirement を見る

Source: REQ-070
