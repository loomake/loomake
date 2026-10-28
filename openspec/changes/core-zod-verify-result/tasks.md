# Tasks

## 1. 仕様

- [x] 1.1 proposal・trace と差分仕様（REQ-273・REQ-274・REQ-275）を書き、仕様ゲートを通す

## 2. 実装

- [x] 2.1 `@loomake/core` の `dependencies` に `zod` を足す。`scripts/schema-contract-check.mjs` が、複製した core のソースから `zod` を読めるようにする。`scripts/package-smoke.mjs` の準備では、外部の実行時依存を npm の cache に入れてから、オフラインで入れる
- [x] 2.2 verify 結果を Zod スキーマで定義し、型をスキーマから導出する。手書きの型を消し、`@loomake/core` からスキーマを公開する。いまの形を受け付け、形の違う結果を拒否し、未知のフィールドを残すことをテストで確かめる（REQ-273・REQ-274）
- [x] 2.3 Zod スキーマから JSON Schema を書き出す関数とコマンドを作り、`packages/core/schema/verify-result.schema.json` を書き出した内容に置き換える。ファイルと書き出した内容が一致することをテストで確かめる（REQ-275）。core のソースを複製して動かす試験（`scripts/domain-mutations.mjs`・`packages/runner/test/guards-special-files.test.ts`）が `zod` を読めるようにし、公開型の試験（`tests/package-artifacts.test.ts`）で壊す宣言を Zod の型に合わせる
- [x] 2.4 changeset を足す

## 3. 確認

- [ ] 3.1 `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` を通す
- [ ] 3.2 `pnpm -s verify --change core-zod-verify-result --done` を通す <!-- loomake:gate=done -->
