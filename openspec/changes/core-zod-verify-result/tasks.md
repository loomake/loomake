# Tasks

## 1. 仕様

- [x] 1.1 proposal・trace と差分仕様（REQ-273・REQ-274・REQ-275）を書き、仕様ゲートを通す

## 2. 実装

- [ ] 2.1 `@loomake/core` の `dependencies` に `zod` を足す。`scripts/schema-contract-check.mjs` が、複製した core のソースから `zod` を読めるようにする
- [ ] 2.2 verify 結果を Zod スキーマで定義し、型をスキーマから導出する。手書きの型を消し、`@loomake/core` からスキーマを公開する。いまの形を受け付け、形の違う結果を拒否し、未知のフィールドを残すことをテストで確かめる（REQ-273・REQ-274）
- [ ] 2.3 Zod スキーマから JSON Schema を書き出す関数とコマンドを作り、`packages/core/schema/verify-result.schema.json` を書き出した内容に置き換える。ファイルと書き出した内容が一致することをテストで確かめる（REQ-275）
- [ ] 2.4 changeset を足す

## 3. 確認

- [ ] 3.1 `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` を通す
- [ ] 3.2 `pnpm -s verify --change core-zod-verify-result --done` を通す <!-- loomake:gate=done -->
