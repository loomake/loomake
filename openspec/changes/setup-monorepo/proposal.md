# setup-monorepo

## Why
Loomake MVP は core・kit・CLI を 1 人で開発し、3 つをつなぐ契約（trace.md の書式・verify の JSON）が頻繁に変わる。1 つの PR でまとめて直せるよう pnpm workspaces のモノレポを用意し、以降の change を CI の完了ゲートで守る土台を先に作る。出典：要件定義書 v0.1 §2・§3・§6・§7、docs/flow.md §0・§4–5

## What Changes
- pnpm workspaces のモノレポ雛形（`packages/core`、`packages/kit`、`packages/cli`）を作る
- devcontainer（Node 24）を標準の開発環境とし、要件書の読み取り用ツールを入れる
- lint・typecheck・test の実行基盤を用意し、`loomake.config.json` の commands から呼べるようにする
- GitHub Actions で、PR ごとに完了ゲート（`verify --done`）と品質コマンドを macOS・Linux・Windows で実行する
- changesets によるパッケージ単位のバージョン管理、MIT ライセンス、Node 20.19 以上の宣言を入れる

## Non-goals
- `@loomake/trace`（検収レポート）— 次フェーズ（REQ-005）
- `@loomake/runner`（実装の自動実行）— 次フェーズ（REQ-006）
- CLI の `trace` と `run` サブコマンド（REQ-007）
- 見積・工数管理、GUI、Web ダッシュボード（REQ-008）
- OpenSpec 以外の仕様フォーマットへの対応（REQ-009）

## Impact
- 影響する capability：monorepo（新規）
- 影響するコード：`package.json`、`pnpm-workspace.yaml`、`packages/*`、`.github/workflows/`、`.changeset/`、`LICENSE`
- 要件書との差：§7 は devcontainer を Node 22 としているが、Q-07 の回答で Node 24 とした。要件書の改訂が必要
