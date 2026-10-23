# improve-init-guidance

## Why
試験プロジェクトで kit を試したとき、init が配った AGENTS.md の `npx loomake verify` が動かず、package.json のないプロジェクトでは commands が必ず失敗する設定のまま残った。init はどちらも知らせなかった（docs/review.md「2026-10-23 試験プロジェクトでの kit の試用」の指摘 1・2）。

## What Changes
- package.json の依存に loomake がないとき、init が最後に、開発用の依存に足すコマンドを案内する（REQ-019）
- package.json がないとき、init が loomake.config.json の commands を書き換えるよう案内する（REQ-024）
- docs/usage.md の導入手順に、loomake を開発用の依存に足す手順を書く

## Non-goals
- init が package.json を書き換えて loomake を足すこと（既存ファイルの上書きにあたる）
- AGENTS.md と Skill の `npx loomake` の書き方を変えること

## Impact
- 影響する capability：init（Requirement の変更）
- 影響するコード：`packages/kit/src/init/init.ts`、`docs/usage.md`
