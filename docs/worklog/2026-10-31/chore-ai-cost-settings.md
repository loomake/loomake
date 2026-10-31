# AI コスト削減の設定（L2）

1. やったこと：作業計画 `.loomake/handoff/workplan-ai-cost-l2-2026-10-31.md` のタスク 1〜8 を実施した（14:30 JST ごろ、システム時計）。`.claude/settings.json` を新規に置き、`autoCompactWindow: 200000` と statusLine を設定した。`.claude/statusline.sh` は node で標準入力の JSON を読み、モデル名と文脈の使用率を 1 行で出す（null のときは `--`）。`.codex/config.toml` を新規に置き、`model_auto_compact_token_limit = 200000` と `tool_output_token_limit = 12000` を書いた。AGENTS.md 2 章 5 に、サブエージェントの長さと `/clear` の 2 つの運用を足した。
2. verify：`pnpm -s lint`・`pnpm -s typecheck` は exit 0。`pnpm -s test` も exit 0 で、134 ファイル・1858 件成功・既存の skip 8 件。yomiyasu の lint は AGENTS.md で error 0（warn 10 件は既存の文）。change はないので `verify --done` は対象外。
3. 残る事項：キー名 `autoCompactWindow` と statusLine の形は公式ドキュメントで確かめ、計画どおりだった。statusLine の command は相対パスなので、セッションの作業ディレクトリがリポジトリのルートであることを前提にしている。リポジトリに `.claude/settings.json` はまだなく、計画にある既存の `permissions` と `autoMode` は個人用の `settings.local.json` にあるため、そのまま残した。
4. 次：PR の必須 5 チェックと独立 Opus のレビュー 1 回を待つ。マージは管理役の判断に任せる。
