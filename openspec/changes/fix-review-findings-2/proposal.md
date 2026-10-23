# fix-review-findings-2

## Why
2026-10-23 の 2 回目のリポジトリ全体のレビュー（review.md）で、修正したほうがよい点が 8 件見つかった。エンジンが tasks.md や差分仕様を書き換えても run が止まらない、`openspecDir` を変えたプロジェクトで仕様の書き換えを見逃す、完了ゲートのあいだは実行時間の上限が効かない、などの穴がある。

## What Changes
- 不正な直し方の検出で、`<openspecDir>/changes/` の下の change の文書（tasks.md・差分仕様など）の変更も見つけ、`openspecDir` の設定を使う（REQ-111、指摘 1・2）
- 完了ゲートの品質コマンドにも、実行時間の残りを上限として渡す（REQ-105、指摘 3）
- テストのレポートが `.gitignore` で除外されていなければ、run を始めない（REQ-094、指摘 4）
- skip の検出に `skipIf`・`runIf`・`it.concurrent.skip` などの書き方を足す（REQ-109、指摘 5）
- run・verify・trace record・trace report で、`/`・`\`・`..` を含む change-id を使い方の誤りにする（REQ-041・REQ-066・REQ-070・REQ-101、指摘 6）
- trace report で、JSON として読めない証拠の記録があれば、そのファイルを示して使い方の誤りにする（REQ-073、指摘 7）
- AGENTS.md のプロジェクト固有の情報を、いまのパッケージ構成に合わせる（指摘 8）

## Non-goals
- init の案内に `.gitignore` の手順を足すこと
- 実際の Claude Code・GitHub への接続の検証

## Impact
- 影響する capability：run・run-guards・verify・trace-record・trace-report（Requirement の変更）
- 影響するコード：`packages/runner/src/run.ts`・`guards.ts`、`packages/kit/src/verify/`、`packages/trace/src/record.ts`・`report.ts`、AGENTS.md
