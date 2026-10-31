## MODIFIED Requirements

### Requirement: 完了ゲートと直し
すべてのタスクを終えたら、`loomake run` は完了ゲート（`verify --done --scope local` と同じ検査）を実行する SHALL。REQ-205の純粋判断が再修正を選ぶ不合格なら、不合格の内容をエンジンに渡して直させ、直しを `run(<change-id>): 完了ゲートの直し（N 回目）` でコミットしてから、もう一度完了ゲートを実行する SHALL。完了ゲートのタスクはエンジンに渡さず、local完了ゲートが0で要判断/abortedがないときにrunがローカル完了として扱う SHALL。CIの最終合格とは区別する MUST。完了ゲートのタスクは、行に `<!-- loomake:gate=done -->` の印があるタスクとする SHALL。印のないタスクでも、本文に `verify` と `--done` を含むものは旧書式の完了ゲートのタスクとみなし、印を付けるよう案内を表示する SHALL。エンジンへの指示とコミットのメッセージには、印を除いたタスクの文を使う SHALL。

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
