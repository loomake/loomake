# run-pr Specification

## Purpose
`loomake run` が完了ゲートに合格したあと、証拠を記録して PR を作るときの振る舞いを定める。記録と PR の順、PR の本文、gh CLI の使い方を含む。

## Requirements

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

### Requirement: PR の本文
PR のタイトルは change-id とする SHALL。本文には、proposal.md の Why と What Changes、完了ゲートの結果、要件ごとのテストファイルの表、証拠の記録のファイルのパスを、この順で含める SHALL。

Source: REQ-115

#### Scenario: 本文の中身
- **WHEN** REQ-012 のテストが tests/x.test.ts にある change で PR を作る
- **THEN** 本文に、proposal.md の Why と What Changes、完了ゲートが合格したこと、REQ-012 と tests/x.test.ts の行、証拠の記録のパスが含まれる

### Requirement: gh CLI で PR を作る
`loomake run` は PR を gh CLI（`gh pr create`）で作る SHALL。gh CLI がないか、ログインしていないときは、エンジンを呼ぶ前に、実装を始めずに止まり、理由を表示して終了コード 1 を返す SHALL。`--dry-run` では gh CLI を確かめない SHALL。完了ゲートに合格したあとも、証拠を記録する前に gh CLI を確かめ、使えなければ証拠を記録せずに止まり、理由を表示して終了コード 1 を返す SHALL。

Source: REQ-116

#### Scenario: gh で作る
- **WHEN** 完了ゲートに合格した run が PR を作る
- **THEN** `gh pr create` が、タイトル・本文・向き先のブランチを渡して呼ばれる

#### Scenario: gh にログインしていない
- **WHEN** `gh auth status` が失敗する環境で `loomake run --change c1` を実行する
- **THEN** エンジンは呼ばれず、`loomake/c1` のブランチも作られず、gh にログインするよう表示され、終了コードは 1 である

#### Scenario: 予定だけの表示では gh を確かめない
- **WHEN** `gh auth status` が失敗する環境で `loomake run --change c1 --dry-run` を実行する
- **THEN** エンジンに渡す予定のタスクが表示され、終了コードは 0 である

#### Scenario: 実行のあいだに gh からログアウトした
- **WHEN** 始めたときは `gh auth status` が成功し、完了ゲートに合格したときには失敗する
- **THEN** 証拠は記録されず、ブランチも送られず、gh にログインするよう表示され、終了コードは 1 である
