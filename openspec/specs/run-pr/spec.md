# run-pr Specification

## Purpose
`loomake run` が完了ゲートに合格したあと、証拠を記録して PR を作るときの振る舞いを定める。記録と PR の順、PR の本文、gh CLI の使い方を含む。

## Requirements

### Requirement: 証拠を記録してから PR を作る
完了ゲートに合格したら、`loomake run` は `loomake trace record` と同じ手順で証拠を記録し、記録のファイルを `evidence(<change-id>): …` でコミットしてから、`loomake/<change-id>` のブランチを origin に送り、PR を作る SHALL。PR の向き先は、run を始めたときに切り替わっていたブランチとする SHALL。

Source: REQ-114

#### Scenario: 合格して PR まで進む
- **WHEN** main から始めた run で、完了ゲートに合格する
- **THEN** `.loomake/evidence/c1/` の記録がコミットされ、`loomake/c1` が origin に送られ、main に向けた PR が作られ、終了コードは 0 である

#### Scenario: 記録が PR より先
- **WHEN** 完了ゲートに合格して PR を作る
- **THEN** PR を作る時点で、ブランチの最後のコミットに証拠の記録が入っている

### Requirement: PR の本文
PR のタイトルは change-id とする SHALL。本文には、proposal.md の Why と What Changes、完了ゲートの結果、要件ごとのテストファイルの表、証拠の記録のファイルのパスを、この順で含める SHALL。

Source: REQ-115

#### Scenario: 本文の中身
- **WHEN** REQ-012 のテストが tests/x.test.ts にある change で PR を作る
- **THEN** 本文に、proposal.md の Why と What Changes、完了ゲートが合格したこと、REQ-012 と tests/x.test.ts の行、証拠の記録のパスが含まれる

### Requirement: gh CLI で PR を作る
`loomake run` は PR を gh CLI（`gh pr create`）で作る SHALL。gh CLI がないか、ログインしていないときは、証拠を記録する前に止まり、理由を表示して終了コード 1 を返す SHALL。

Source: REQ-116

#### Scenario: gh で作る
- **WHEN** 完了ゲートに合格した run が PR を作る
- **THEN** `gh pr create` が、タイトル・本文・向き先のブランチを渡して呼ばれる

#### Scenario: gh にログインしていない
- **WHEN** `gh auth status` が失敗する環境で、完了ゲートに合格する
- **THEN** 証拠は記録されず、ブランチも送られず、gh にログインするよう表示され、終了コードは 1 である
