# add-init-cli

## Why
Loomake を既存のプロジェクトに入れる手間が大きいと、使われない。`npx loomake init` だけで、AGENTS.md・CLAUDE.md・設定・Skill が正しい場所に置かれ、既存ファイルは壊れないようにする。出典：要件定義書 v0.1 §5.1

## What Changes
- `loomake init` で AGENTS.md・CLAUDE.md・loomake.config.json・req-to-openspec Skill を配置する
- 同名ファイルがある場合は上書きせず、差分を表示して確認を求める
- `--codex` で Skill を `.agents/skills/` にも配置し、`--devcontainer` で `.devcontainer/devcontainer.json` を配置する
- `openspec/` が無い場合は `openspec init` の実行を案内する
- package.json から pnpm・npm・yarn を判定し、loomake.config.json の commands の既定値に反映する
- メッセージを日本語で提供する

## Non-goals
- `openspec init` の自動実行（案内のみ。REQ-023）
- Skill・AGENTS.md の中身の整備（add-kit-assets）
- `verify` の実装（add-verify-cli）
- `trace`・`run` サブコマンド（setup-monorepo の Non-goals を参照）

## Impact
- 影響する capability：init（新規）
- 影響するコード：`packages/kit/`、`packages/cli/`（`loomake`）
- 前提：setup-monorepo・add-core-parsers・add-kit-assets が完了していること
- 確認できない環境（CI など）で同名ファイルがあれば、何も置かずに終了コード 1 で中止する（Q-06 の回答）
