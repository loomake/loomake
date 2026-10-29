# Design: core-quality-yaml-schema

## Context

この文書は [PR #128](https://github.com/loomake/loomake/pull/128) の受入後、実装済みの設計を記録するために補記した。背景と対象は [proposal.md](proposal.md)、承認済みの値と書式は [trace.md](trace.md) の Q-01〜Q-04・A-01・A-02 に従う。`@loomake/core` の外部の実行時依存は `zod` だけであり、YAML の読み込みは kit の役割である。

## Goals / Non-Goals

スキーマ・型・配布用 JSON Schema を同じ定義から導き、入力の検証、既定値の補完、未知のフィールドの保持をそろえる。core の入口を読むだけでは zod を読み込まない。

この change は YAML の読み込み、verify への接続、quality-report、trace.md・spec・tasks の版を扱わない。

## Decisions

### スキーマから型を導出する

`quality-schema.ts` に Zod スキーマを置く。`quality.ts` の `QualityInput` と `Quality` はそれぞれ `z.input`・`z.output` から導き、既定値を補う前後を区別する。対応する版は定数 `QUALITY_SCHEMA_VERSION = 2` で表す（REQ-283・REQ-284）。

### 解析で使うときに読み込む

core の入口は `quality.ts` の版・型・`loadQualitySchema()` を公開する。型の参照には `import type` を使い、関数内の動的 import でスキーマを読む。verify 結果のスキーマと同じ形にし、起動時に zod を静的に読む経路を増やさない（REQ-284）。

### 既定値と未知のフィールドを扱う

オブジェクトは `z.looseObject` で定義し、未知のフィールドを解析結果に残す。項目の `evidence`・`indicators` は省略時に空配列にする。証跡の保管方針は `prefault({})` と各キーの既定値で補う。値と書式は trace の承認済み判断と要件定義 7.1 の最小スキーマを反映する（REQ-283・REQ-285）。

### 対象外の条件を配布用スキーマにも反映する

`applicability` の分岐は `z.discriminatedUnion` で表し、対象外では `reason` と `confirmed_by` を必須にする。PR #128 の独立レビューで、`superRefine` による条件が JSON Schema に出ない点を修正した。Zod と配布 JSON Schema に同じ入力を渡し、対象外の必須キーの欠落を両方が拒否する試験を置く（REQ-286・REQ-287）。

### JSON Schema の差分を検出する

既存の `CONTRACT_SCHEMAS` に quality スキーマを登録する。`z.toJSONSchema` の `io: 'input'` で入力時の省略を表し、`renderJsonSchemas()` と配布ファイルの内容をテストで比較する。`packages/core/schema/quality.schema.json` は通常の exports と publishConfig.exports から公開する。既存の verify 結果の JSON Schema は変更していない（REQ-287）。

## Risks / Trade-offs

JSON Schema に変換できない検証を加えると、Zod と外部ツールの受理条件が異なる。対象外の分岐は JSON に変換できる形を使い、Ajv と Zod に同じ入力を渡す試験と生成物の一致試験で確かめる。

値の一覧が未決の `model`・`characteristic`・`subcharacteristic`・`source` は、trace の Q-01 の承認どおり空でない文字列として扱う。

## Migration Plan

スキーマと型の追加は PR #128 で受け入れ済み。quality.yaml の対応版は `2` とし、既存の verify 結果の JSON の形と版は変えていない。
