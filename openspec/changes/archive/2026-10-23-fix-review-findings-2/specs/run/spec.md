## MODIFIED Requirements

### Requirement: 未コミットの変更があるときは始めない
作業ツリーに未コミットの変更（git が追跡していない新しいファイルを含み、`.gitignore` で除外したファイルを含まない）があるとき、`loomake run` は実装を始めず、変更のあるファイルを表示して終了コード 1 を返す SHALL。loomake.config.json の `tests.report` のファイルが `.gitignore` で除外されていないときも、実装を始めず、`.gitignore` に足すよう表示して終了コード 1 を返す SHALL。

Source: REQ-094

#### Scenario: 変更したファイルがある
- **WHEN** コミット済みのファイルを書き換えた状態で `loomake run --change c1` を実行する
- **THEN** そのファイル名が表示され、エンジンは呼ばれず、終了コードは 1 である

#### Scenario: 追跡していないファイルがある
- **WHEN** git が追跡していない新しいファイルがある状態で `loomake run --change c1` を実行する
- **THEN** エンジンは呼ばれず、終了コードは 1 である

#### Scenario: テストのレポートを除外していない
- **WHEN** `.loomake/test-report.json` を `.gitignore` で除外していないプロジェクトで `loomake run --change c1` を実行する
- **THEN** `.gitignore` に足すよう表示され、エンジンは呼ばれず、終了コードは 1 である

### Requirement: エンジンの選び方と権限
`loomake run` は `--engine` でエンジンを選び、省いたときは `claude-code` とする SHALL。知らないエンジンの名前と、`claude` コマンドが見つからないときと、change-id に `/`・`\`・`..` を含むときは、使い方の誤りとして終了コード 2 を返す SHALL。Claude Code は headless（`claude -p`、出力は JSON）で呼び、指示は標準入力で渡す SHALL。ふだんは、ファイルの読み書きと、loomake.config.json の commands の実行だけを許可する操作の一覧として渡す SHALL。

Source: REQ-101

#### Scenario: 許可する操作の一覧を渡す
- **WHEN** commands に `pnpm test` を持つプロジェクトで、`--skip-permissions` を付けずに実行する
- **THEN** `claude` は `-p` と JSON の出力の指定で呼ばれ、許可する操作の一覧にファイルの読み書きと `pnpm test` が入り、権限確認を飛ばす指定は入らない

#### Scenario: 知らないエンジン
- **WHEN** `loomake run --change c1 --engine codex` を実行する
- **THEN** 初版で使えるのは claude-code だけだと表示され、終了コードは 2 である

#### Scenario: claude コマンドがない
- **WHEN** `claude` コマンドのない環境で `loomake run --change c1` を実行する
- **THEN** Claude Code を入れるよう表示され、終了コードは 2 である

#### Scenario: パスの区切りを含む change-id
- **WHEN** `loomake run --change ../c1` を実行する
- **THEN** change-id にパスの区切りを含められないと表示され、終了コードは 2 である

### Requirement: 実行時間の上限
`loomake run` を始めてからの時間が上限に達したら、`loomake run` はエンジンのプロセスか、完了ゲートの品質コマンドのプロセスを止めて、止まる SHALL。上限の既定は 60 分とし、loomake.config.json の `run.timeoutMinutes` で変えられる SHALL。

Source: REQ-105

#### Scenario: 上限に達する
- **WHEN** 実行時間の上限を短くして、終わらないエンジンで実行する
- **THEN** エンジンのプロセスが止められ、時間の上限に達したことが報告され、終了コードは 1 である

#### Scenario: 完了ゲートのあいだに上限に達する
- **WHEN** 実行時間の上限を短くして、終わらないテストのコマンドを持つプロジェクトで実行する
- **THEN** テストのプロセスが止められ、時間の上限に達したことが報告され、終了コードは 1 である
