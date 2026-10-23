## MODIFIED Requirements

### Requirement: 証拠を記録してから PR を作る
完了ゲートに合格したら、`loomake run` は `loomake trace record` と同じ手順で証拠を記録し、記録のファイルを `evidence(<change-id>): …` でコミットしてから、`loomake/<change-id>` のブランチを origin に送り、PR を作る SHALL。PR の向き先は、run が `loomake/<change-id>` を作ったときに切り替わっていたブランチとし、ブランチを作るときに git の設定（`branch.loomake/<change-id>.loomake-base`）に覚えておく SHALL。再開のときは覚えた向き先を使い、覚えていなければ run を始めたときに切り替わっていたブランチを使う SHALL。そのどちらも `loomake/<change-id>` 自身になるときは、証拠を記録する前に止まり、向き先が分からないことを表示して終了コード 1 を返す SHALL。

Source: REQ-114

#### Scenario: 合格して PR まで進む
- **WHEN** main から始めた run で、完了ゲートに合格する
- **THEN** `.loomake/evidence/c1/` の記録がコミットされ、`loomake/c1` が origin に送られ、main に向けた PR が作られ、終了コードは 0 である

#### Scenario: 記録が PR より先
- **WHEN** 完了ゲートに合格して PR を作る
- **THEN** PR を作る時点で、ブランチの最後のコミットに証拠の記録が入っている

#### Scenario: 実装ブランチの上で再開する
- **WHEN** main から始めた run が途中で止まり、`loomake/c1` に切り替わったまま、もう一度 run を実行して完了ゲートに合格する
- **THEN** main に向けた PR が作られる

#### Scenario: 向き先が分からない
- **WHEN** 人が作った `loomake/c1` の上で run を実行し、完了ゲートに合格する
- **THEN** 証拠を記録せずに止まり、向き先が分からないことが表示され、終了コードは 1 である
