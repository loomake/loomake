## MODIFIED Requirements

### Requirement: gh CLI で PR を作る
`loomake run` は PR を gh CLI（`gh pr create`）で作る SHALL。新しく作るPRは`--draft`を渡してDraft PRとする SHALL。gh CLI がないか、ログインしていないときは、エンジンを呼ぶ前に、実装を始めずに止まり、理由を表示して終了コード 1 を返す SHALL。`--dry-run` では gh CLI を確かめない SHALL。完了ゲートに合格したあとも、証拠を記録する前に gh CLI を確かめ、使えなければ証拠を記録せずに止まり、理由を表示して終了コード 1 を返す SHALL。

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


#### Scenario: 新しいPRはDraftで作る
- **WHEN** 同じbase/headのopen PRがなく、完了ゲートに合格したrunが新しいPRを作る
- **THEN** 向き先・タイトル・本文に加えて--draftを1つ渡して1回だけ作り、終了コード0で終える

#### Scenario: Draft作成の失敗時にReadyへ切り替えない
- **WHEN** gh pr create --draftが失敗する
- **THEN** --draftなしの再作成はせず、証拠のコミットを保って既存の失敗経路で終了コード1を返す
