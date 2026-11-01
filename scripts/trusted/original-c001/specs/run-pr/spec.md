## MODIFIED Requirements

### Requirement: 証拠を記録してから PR を作る
scope:localの完了ゲートが0で要判断/abortedもなければ、`loomake run` は `loomake trace record` と同じ手順で明示localのEvidence 2を記録し、記録ファイルを `evidence(<change-id>): …` でコミットしてから、`loomake/<change-id>` のブランチを origin に送り、Draft PR を作る SHALL。PR の向き先は、run が `loomake/<change-id>` を作ったときに切り替わっていたブランチとし、ブランチを作るときに git の設定（`branch.loomake/<change-id>.loomake-base`）に覚えておく SHALL。再開のときは覚えた向き先を使い、覚えていなければ run を始めたときに切り替わっていたブランチを使う SHALL。そのどちらも `loomake/<change-id>` 自身になるときは、証拠を記録する前に止まり、向き先不明を表示して終了コード 1 を返す SHALL。

Source: REQ-114

#### Scenario: 合格して PR まで進む
- **WHEN** main から始めた run で、local完了ゲートが0で要判断/abortedがない
- **THEN** `.loomake/evidence/c1/` の記録がコミットされ、`loomake/c1` が origin に送られ、main に向けた PR が作られ、終了コードは 0 である

#### Scenario: 記録が PR より先
- **WHEN** local完了ゲートが0で要判断/abortedなく PR を作る
- **THEN** PR を作る時点で、ブランチの最後のコミットに証拠の記録が入っている

#### Scenario: 実装ブランチの上で再開する
- **WHEN** main から始めた run が途中で止まり、`loomake/c1` に切り替わったまま、もう一度 run を実行してlocal完了ゲートが0で要判断/abortedがない
- **THEN** main に向けた PR が作られる

#### Scenario: 向き先が分からない
- **WHEN** 人が作った `loomake/c1` の上で run を実行し、local完了ゲートが0で要判断/abortedがない
- **THEN** 証拠を記録せずに止まり、向き先が分からないことが表示され、終了コードは 1 である

#### Scenario: local結果とCI最終合格の区別
- **WHEN** local完了を記録してPRを作る
- **THEN** Draft PRとし、その記録やPR作成の0をCI最終合格と扱わない

### Requirement: PR の本文
PR のタイトルは change-id とする SHALL。本文には、proposal.md の Why と What Changes、scope:localの完了結果とCI最終合格は別に確認する旨、要件ごとのテストファイルの表、証拠の記録のファイルのパスを、この順で含める SHALL。

Source: REQ-115

#### Scenario: 本文の中身
- **WHEN** REQ-012 のテストが tests/x.test.ts にある change で PR を作る
- **THEN** 本文に、proposal.md の Why と What Changes、local完了が0であることとCI最終合格は別に未確認である旨、REQ-012 と tests/x.test.ts の行、証拠の記録のパスが含まれる
