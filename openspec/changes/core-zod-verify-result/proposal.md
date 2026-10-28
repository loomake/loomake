# Proposal: core-zod-verify-result

## Why

WBS の W1-1（[Issue #60](https://github.com/loomake/loomake/issues/60)）は、core の契約を Zod スキーマで定義し、型をスキーマから導出し、JSON Schema を書き出すことを求めている。完了条件は「スキーマから型を導出し、JSON Schema の書き出しが CI で差分を出さない。手書きの型の重複定義が残らない」である。

いまの verify 結果は手書きの型（`packages/core/src/verify-result.ts`）と手書きの JSON Schema（`packages/core/schema/verify-result.schema.json`）の 2 か所で同じ形を定義している。ADR 0003 で core の実行時依存に `zod` を採ると決め、依存を足すのは W1-1 とした。

W1-1 の範囲は広い（verify 結果、trace.md・spec・tasks、quality.yaml、quality-report、証拠とレポート）。この change ではその最初の部分として次の 2 つを行う。

- verify 結果を Zod スキーマに移す
- JSON Schema を書き出す仕組みと、その差分を CI で検査する仕組みを作る

ほかの契約はこの仕組みに後続の change で足していく。

## What Changes

- `@loomake/core` の `dependencies` に `zod` を足す。
- verify 結果を Zod スキーマ（`verifyResultSchema`。`@loomake/core` からは `loadVerifyResultSchemas()` で読む）で定義し、`VerifyResult`・`VerifyCheckResult`・`VerifyMode` の型をスキーマから導出する。手書きの型は消す。外部の形（`schemaVersion` 1.0.0、必須プロパティ、`mode`・`status` の値、`coverage` の形）は変えない。
- CLI の起動で zod を読まないように、Zod スキーマは `loadVerifyResultSchemas()` で遅れて読む。型は型だけの import で公開する。
- 未知のフィールドは拒否せず、解析結果にそのまま残す（要件定義 7.3 の互換性の規則）。
- `packages/core/schema/verify-result.schema.json` を、Zod スキーマから `z.toJSONSchema()` で書き出したものに置き換える。書き出しのコマンドを用意し、書き出した結果とファイルが違えばテストが失敗するようにする。テストは CI で動く。
- `scripts/schema-contract-check.mjs` は、複製した core のソースから `zod` を読めるようにする。`scripts/package-smoke.mjs` の準備では、外部の実行時依存を npm の cache に入れてから、オフラインで入れる。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `core-parsers`: verify 結果のスキーマを Zod で定義し、型と JSON Schema をスキーマから導出する要件（REQ-273・REQ-274・REQ-275）を足す。既存の「verify 結果の JSON スキーマ」（REQ-016・REQ-053）は変えない。

## Impact

`packages/core`（`package.json`・`src/verify-result.ts`・`src/json-schema.ts`・`src/index.ts`・`schema/verify-result.schema.json`・テスト）、`pnpm-lock.yaml`、`scripts/schema-contract-check.mjs`、`scripts/package-smoke.mjs` を変える。`@loomake/core` に実行時依存 `zod` が入り、公開 API に Zod スキーマが増えるので、changeset を足す。kit・trace・runner・CLI が出す JSON の形は変えない。

trace.md・spec・tasks・quality.yaml・quality-report のスキーマと、証拠・レポートの版の移行は、後続の change で行う。
