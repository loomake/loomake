## MODIFIED Requirements

### Requirement: エンジンの選び方と権限
`loomake run` は `--engine` でエンジンを選び、省いたときは `claude-code` とする SHALL。知らないエンジンの名前と、`claude` コマンドが見つからないときと、change-id が OpenSpec の change 名の形（英小文字・数字と、間に 1 つずつのハイフン）でないとき（`/`・`\`・`..` を含むときを含む）と、`archive` のときは、使い方の誤りとして終了コード 2 を返す SHALL。Claude Code は headless（`claude -p`、出力は JSON）で呼び、指示は標準入力で渡す SHALL。ふだんは、ファイルの読み書きと、loomake.config.json の commands の実行だけを許可する操作の一覧として渡す SHALL。

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
