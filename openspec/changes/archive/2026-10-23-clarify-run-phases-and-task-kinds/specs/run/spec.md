## MODIFIED Requirements

### Requirement: 完了ゲートと直し
すべてのタスクを終えたら、`loomake run` は完了ゲート（`verify --done` と同じ検査）を実行する SHALL。不合格なら、不合格の内容をエンジンに渡して直させ、直しを `run(<change-id>): 完了ゲートの直し（N 回目）` でコミットしてから、もう一度完了ゲートを実行する SHALL。完了ゲートのタスクはエンジンに渡さず、完了ゲートに合格したときに run が完了にする SHALL。完了ゲートのタスクは、行に `<!-- loomake:gate=done -->` の印があるタスクとする SHALL。印のないタスクでも、本文に `verify` と `--done` を含むものは旧書式の完了ゲートのタスクとみなし、印を付けるよう案内を表示する SHALL。エンジンへの指示とコミットのメッセージには、印を除いたタスクの文を使う SHALL。

Source: REQ-100

#### Scenario: 直して合格する
- **WHEN** 1 回目の完了ゲートに不合格になり、エンジンが直したあとの 2 回目で合格する
- **THEN** エンジンへの 2 回目の指示に 1 回目の不合格の内容が含まれ、直しが「完了ゲートの直し（1 回目）」でコミットされ、完了ゲートのタスクが `- [x]` になる

#### Scenario: 完了ゲートのタスクはエンジンに渡さない
- **WHEN** tasks.md の最後のタスクが「`pnpm -s verify --change c1 --done` を通す」の change を実行する
- **THEN** そのタスクはエンジンに渡されない

#### Scenario: 印のあるタスク
- **WHEN** tasks.md の最後のタスクが「品質の確認を通す <!-- loomake:gate=done -->」の change を実行する
- **THEN** そのタスクはエンジンに渡されず、完了ゲートに合格したときに `- [x]` になる

#### Scenario: 旧書式のタスク
- **WHEN** 印がなく、本文が「`pnpm -s verify --change c1 --done` を通す」のタスクを持つ change を実行する
- **THEN** そのタスクはエンジンに渡されず、行に `<!-- loomake:gate=done -->` を付けるよう案内が表示される

#### Scenario: 印は指示とメッセージに含めない
- **WHEN** 印のある完了ゲートのタスクを持つ change で、完了ゲートに不合格のまま直しの回数の上限に達して止まる
- **THEN** 残ったタスクの表示と summary.json の完了ゲートのタスクに `<!-- loomake:gate=done -->` が含まれない

## ADDED Requirements

### Requirement: 実行中の失敗
`loomake run` を始める前（実行の記録を作る前）の git の失敗は、使い方の誤りとして終了コード 2 を返す SHALL。実行の記録を作ったあとに git の操作か証拠の記録が失敗したときは、`git の操作に失敗しました` などの理由と、終えたタスク・残ったタスクを表示して `summary.json` に書き、終了コード 1 で止まる SHALL。

Source: REQ-137

#### Scenario: 実行中に git のコミットが失敗する
- **WHEN** 1 つ目のタスクを終えたあと、コミットが git のフックで失敗する
- **THEN** run は止まり、理由に git の操作に失敗したことが含まれ、残ったタスクに 1 つ目のタスクがあり、summary.json に同じ内容が書かれ、終了コードは 1 である

#### Scenario: 始める前の git の失敗
- **WHEN** git のリポジトリでないディレクトリで `loomake run --change c1` を実行する
- **THEN** 実行の記録は作られず、終了コードは 2 である
