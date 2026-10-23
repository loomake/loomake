## MODIFIED Requirements

### Requirement: エンジンへの指示
エンジンへの指示は、AGENTS.md の全文、対象のタスク、change の差分仕様のすべての spec.md、trace.md を含む SHALL。あわせて、tasks.md・trace.md・`openspec/specs/` を書き換えないことと、仕様にない判断が要るときは `LOOMAKE-QUESTION:` で始まる行に質問を書いて何も変えずに終えることを、決まりとして含む SHALL。git でコミットしたりブランチを切り替えたりせず、変更は作業ツリーに残して終えること（コミットは loomake run が行うこと）も、決まりとして含む SHALL。

Source: REQ-098

#### Scenario: 指示の中身
- **WHEN** `loomake run --change c1 --dry-run` で最初のタスクの指示を表示する
- **THEN** 指示に、AGENTS.md の全文・タスクの行・差分仕様・trace.md・2 つの決まりが含まれる

#### Scenario: コミットしない決まり
- **WHEN** `loomake run --change c1 --dry-run` で最初のタスクの指示を表示する
- **THEN** 指示に、git でコミットしたりブランチを切り替えたりしないことと、コミットは loomake run が行うことが含まれる
