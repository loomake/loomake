# clarify-run-phases-and-task-kinds

## Why
`loomake run` は、完了ゲートのタスクかどうかを、タスクの文に「verify」と「--done」があるかで決めている。tasks.md の書き方が少し変わると、完了ゲートのタスクをエンジンに渡してしまう。また、実行中の git の失敗は使い方の誤り（終了コード 2）になり、実行の記録にも残らない。`runRun` は 1 つの長い関数で、段階ごとの入力と停止の理由を追いにくい。docs/evaluation.md の「技術面」の気になる点 3・4 と「構成」で指摘された。

## What Changes
- 完了ゲートのタスクを、行の `<!-- loomake:gate=done -->` の印で決める。印のない旧書式も受け付け、印を付けるよう案内する（REQ-100・REQ-136）
- req-to-openspec Skill の tasks.md の雛形に、印を付ける（REQ-136）
- run を始めたあとの git の失敗と証拠の記録の失敗は、実行の記録に理由を書いて終了コード 1 で止まる。始める前の git の失敗は、これまでどおり終了コード 2 にする（REQ-137）
- `runRun` を、事前の確認・タスクの実行・完了ゲートと直し・証拠の記録と PR 作成の段階ごとの関数に分ける。振る舞いは変えない

## Non-goals
- 完了ゲートのほかのタスクの種別（人が行うタスクなど）
- 旧書式の受け付けをやめる時期を決めること
- 中断したところからの再開

## Impact
- 影響する capability：run（Requirement の変更と追加）、req-to-openspec-skill（Requirement の追加）
- 影響するコード：`packages/runner/src/run.ts`・`git.ts`、`packages/kit/templates/skills/req-to-openspec/`、`.agents/skills/req-to-openspec/`
