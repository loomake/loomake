---
"@loomake/core": minor
"@loomake/kit": minor
"@loomake/trace": minor
"@loomake/runner": minor
"loomake": minor
---

最初の公開。

- `loomake init`：AGENTS.md・CLAUDE.md・loomake.config.json と、要件書を出典つきの OpenSpec change に変える Skill を置く
- `loomake verify`：仕様ゲート（`--spec-only`）と完了ゲート（`--done`）で、確認事項・仕様・tasks・要件ごとのテスト・品質コマンドを検査する
- `loomake trace`：検査の結果を証拠として記録し（`record`）、検収レポートを出す（`report`）
- `loomake run`：change のタスクを AI に 1 つずつ実装させ、完了ゲートを通して PR を作る
- `loomake doctor`：導入の状態を調べ、足りない設定と直し方を表示する
- 動作環境は Node.js 22.12 以上
