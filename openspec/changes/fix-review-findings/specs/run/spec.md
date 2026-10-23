## MODIFIED Requirements

### Requirement: change のブランチ
`loomake run` は、`loomake/<change-id>` のブランチで実装する SHALL。ブランチがなければいまの HEAD から作り、あればそこに切り替えて続ける SHALL。ブランチがあるときは、未コミットの変更の確認のあと、エンジンに渡すタスクを読む前にそのブランチへ切り替え、仕様ゲートとタスクの読み取りをそのブランチの内容で行う SHALL。`--dry-run` のときは、表示のあとに元のブランチへ戻す SHALL。

Source: REQ-096

#### Scenario: ブランチがない
- **WHEN** `loomake/c1` のブランチがないリポジトリで `loomake run --change c1` を実行する
- **THEN** いまの HEAD から `loomake/c1` が作られ、そのブランチでコミットされる

#### Scenario: ブランチがある
- **WHEN** `loomake/c1` のブランチがすでにあるリポジトリで `loomake run --change c1` を実行する
- **THEN** `loomake/c1` に切り替えて、その続きにコミットされる

#### Scenario: 別のブランチから再開する
- **WHEN** `loomake/c1` では 1.1 が `- [x]`、main では 1.1 が `- [ ]` のとき、main で `loomake run --change c1` を実行する
- **THEN** エンジンに 1.1 は渡されず、1.2 から渡される

### Requirement: タスクごとのコミット
エンジンがタスクを終えるたびに、`loomake run` は tasks.md のそのタスクを `- [x]` にし、エンジンの変更と合わせて `run(<change-id>): <タスクの番号と本文>` のメッセージでコミットする SHALL。tasks.md のタスクを完了にするのは run であり、エンジンではない SHALL。エンジンが 0 以外の終了コードで終わったとき（終了コードが得られないときを含む）は、そのタスクを完了にせず、コミットもせずに、終了コードを理由として止まる SHALL。

Source: REQ-099

#### Scenario: タスクを終える
- **WHEN** エンジンが 1.1 のタスクでファイルを 1 つ足して終える
- **THEN** そのファイルと、1.1 を `- [x]` にした tasks.md が、`run(c1): 1.1 …` のメッセージで 1 つのコミットになる

#### Scenario: エンジンが失敗する
- **WHEN** エンジンが 1.1 のタスクで終了コード 1 で終わる
- **THEN** 1.1 は `- [ ]` のままで、コミットは増えず、run は終了コード 1 で止まる
