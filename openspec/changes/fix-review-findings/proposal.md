# fix-review-findings

## Why
2026-10-23 のリポジトリ全体のレビュー（review.md）で、修正が必要な点が 6 件見つかった。run が作る PR で CI の完了ゲートが動かない、エンジンが失敗してもタスクを完了にする、子パッケージの検査コマンドの変更を見逃す、確認事項の列名が崩れると仕様ゲートを通過するなど、完了の定義を守れない穴がある。

## What Changes
- CI の完了ゲートは `loomake/<change-id>` のブランチ名からも change-id を取り出す（REQ-010、指摘 1）
- エンジンが 0 以外の終了コードで終わったら、タスクを完了にせず、コミットもせずに止まる（REQ-099、指摘 2）
- `loomake/<change-id>` のブランチがあるときは、先にそのブランチへ切り替えてから、仕様ゲートとタスクの読み取りを行う（REQ-096、指摘 3）
- 不正な直し方の検出で、リポジトリの中のすべての package.json の `scripts` を比べる（REQ-110、指摘 4）
- trace.md の表に必須の列がないときは、解析エラーにする（REQ-011、指摘 5）
- PR の向き先は、run が `loomake/<change-id>` を作ったときのブランチを覚えておき、再開のときもそれを使う（REQ-114、指摘 6）

## Non-goals
- 実際の Claude Code・GitHub への接続の検証
- 合意の列（回答者・回答日・承認者・承認日）を必須にすること

## Impact
- 影響する capability：monorepo・run・run-pr・run-guards・core-parsers（Requirement の変更）
- 影響するコード：`scripts/ci-gate.mjs`、`packages/runner/src/run.ts`・`guards.ts`、`packages/core/src/parse.ts`・`trace.ts`
