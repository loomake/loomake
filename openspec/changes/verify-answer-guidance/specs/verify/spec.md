## ADDED Requirements

### Requirement: 回答の反映漏れの案内
spec-onlyは、確認待ちの要件の案内で、確認事項の「関連」の列にその要件IDと完全に一致するIDを持つ確認事項のIDを、確認事項の表の順に重複なく要件IDのあとへ示す SHALL。関連する確認事項がない要件は要件IDだけを示す SHALL。回答が空でない確認事項の「関連」にある要件が確認待ちのときと、changeの差分仕様のコードブロックの外に回答が空でない確認事項のIDが残っているときは、それぞれを案内つきの合格として示す SHALL。これらの案内だけでは不合格・pending・要判断を立てず終了コードを変えない MUST。doneの判定と出力は変えない MUST。

Source: REQ-360

#### Scenario: 確認待ちの要件に対応するQ
- **WHEN** 関連がREQ-027のQ-15と、確認待ちのREQ-027を持つchangeに--spec-onlyを実行する
- **THEN** 確認待ちの要件の案内に「REQ-027（Q-15）」が出て、終了コードは0である
#### Scenario: 関連するQがない
- **WHEN** どの確認事項の関連にもない確認待ちのREQ-002を持つchangeに--spec-onlyを実行する
- **THEN** 案内は「REQ-002」のままである
#### Scenario: 回答済みのQの要件が確認待ち
- **WHEN** 回答のあるQ-15の関連にある REQ-029 が確認待ちのchangeに--spec-onlyを実行する
- **THEN** Q-15とREQ-029が案内つきの合格で出て、pendingと要判断は立たず終了コードは0である
#### Scenario: specに回答済みのQの参照が残る
- **WHEN** 回答のあるQ-15を、差分仕様のコードブロックの外で参照するchangeに--spec-onlyを実行する
- **THEN** そのファイル名・行番号・Q-15が案内つきの合格で出て、終了コードは0である
#### Scenario: 未回答のQの参照
- **WHEN** 回答が空のQ-15だけを差分仕様で参照するchangeに--spec-onlyを実行する
- **THEN** 参照の案内は出ない

### Requirement: 回答と承認の書き方の案内
人が読むverifyの表示は、ブロッキング確認事項の不合格の詳細のあとに、changeのtrace.mdの「確認事項」の表の該当する行の「回答」に回答を決めた人が書くことと `loomake trace answer` の書き方を一行で示す SHALL。未承認の仮定の詳細のあとに、「仮定」の表の「承認」に `承認` と書くことと `loomake trace approve` の書き方を一行で示す SHALL。この案内はJSONの結果に含めず、検査の分類・詳細・終了コードを変えない MUST。

Source: REQ-361

#### Scenario: ブロッキング失敗の書き方
- **WHEN** 未回答のブロッキングQ-15を持つchangeの結果を人向けに表示する
- **THEN** 「Q-15（REQ-012）…」の次の行に回答の書き方が出て、JSONには含まれない
#### Scenario: 未承認の仮定の書き方
- **WHEN** 未承認のA-01を持つchangeの spec-only と done の結果を人向けに表示する
- **THEN** 未承認の詳細の次の行に承認の書き方が出て、終了コードはそれぞれ0と1のままである
