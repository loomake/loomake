# Proposal: core-quality-yaml-schema

## Why

WBS の W1-1（[Issue #60](https://github.com/loomake/loomake/issues/60)）の 2 つ目の部分。change core-zod-verify-result（PR #113）で、verify 結果を Zod スキーマに移し、JSON Schema を書き出す処理と、zod を遅れて読む形を作った。この change では同じ形で quality.yaml（要件定義 7.1）のスキーマを足す。

quality-report のスキーマと、trace.md・spec・tasks の版は、この change の範囲外とする。対応方針は [Issue #60 のコメント](https://github.com/loomake/loomake/issues/60#issuecomment-6480846573) で決定済みで、別の change で実装する。

## What Changes

- quality.yaml を YAML として解析した値の Zod スキーマを core に足す。形式の版 `version` を必須にする。
- `objectives`（利用時品質目標）と `product`（製品品質要件）、合格証拠（`evidence`）と参考指標（`indicators`）、`automation`、`evidence:`（証跡の保管方針）を定義する。`evidence:` は要件定義 7.1 の最小スキーマのとおりに既定値を補う。
- `applicability: not_applicable` の項目には理由（`reason`）と確認者（`confirmed_by`）を必須にする。
- 型はスキーマから導出する。zod は解析で使うときに初めて読む（PR #113 と同じ形）。
- `packages/core/schema/quality.schema.json` を Zod スキーマから書き出し、ファイルとの差分をテストで検出する。

YAML の読み込み（kit の `yaml`）と、verify から quality.yaml を読む処理は、この change では作らない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `core-parsers`: quality.yaml のスキーマの要件（REQ-283〜REQ-287）を足す。

## Impact

`packages/core`（`src/`・`schema/`・テスト）と changeset を変える。kit・trace・runner・CLI は変えない。
