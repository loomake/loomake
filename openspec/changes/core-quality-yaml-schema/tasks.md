# Tasks

## 1. 仕様

- [x] 1.1 proposal・trace と差分仕様（REQ-283〜REQ-287）を書き、確認事項の回答を得て仕様ゲートを通す

## 2. 実装

- [x] 2.1 quality.yaml の Zod スキーマを `packages/core/src/quality-schema.ts` に書き、型をスキーマから導出する。`@loomake/core` からは `loadQualitySchema()` で読む（REQ-283・REQ-284・REQ-285・REQ-286）
- [x] 2.2 `schema/quality.schema.json` を書き出し、ファイルとの差分をテストで検出する（REQ-287）
- [ ] 2.3 changeset を足す

## 3. 確認

- [ ] 3.1 `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` を通す
- [ ] 3.2 `pnpm -s verify --change core-quality-yaml-schema --done` を通す <!-- loomake:gate=done -->
