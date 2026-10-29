# Design: core-quality-report-schema

## Context

背景は proposal.md に記載した。要件定義の FR-25・FR-30・FR-31・7.8 はレポートの内容を説明しているが、JSON の具体的なキー名と型を定めていない。Issue #60 の方針に加え、本会話で Q-01 の案 A が承認された。

既存の `packages/trace/src/report.ts` は `Report` と `REPORT_SCHEMA_VERSION = 2` を持ち、change ごとのリリースレポートを出力する。新しい quality-report の生成・評価はまだ実装されていない。

## Goals / Non-Goals

- 承認された最小契約の入力例と検証範囲を示す。
- 初期契約のスキーマを公開し、既存の同期 API と JSON 形式を維持する。
- `version` の値以外から達成度や公開可否を推測する処理は含めない。

## Decisions

### 承認された初期形

最小入力は `{ "version": 1 }` である。Zod のオブジェクトスキーマで `version` を数値の `1` に限定し、未知のキーと値を保持する。日時・評価対象・結果のキー名や型は決めず、既定値も補わない。

`QualityReport` はスキーマから導出する。`QUALITY_REPORT_SCHEMA_VERSION = 1` と `loadQualityReportSchema()` は zod を静的に読まないモジュールから公開し、loader が `qualityReportSchema` を動的 import する。JSON Schema は既存の書き出し処理から生成し、`schema/quality-report.schema.json` を通常の exports と publishConfig.exports の両方で公開する。型の重複定義や外部依存は追加しない。

### 採用しなかった案 B

日時・評価対象・結果まで今回の契約に含める案は採用しない。具体的なフィールド名・型・必須性は W1-11（Issue #70）の仕様で決める。

### 既存形式との区別

新しい quality-report の `version` と、既存のリリースレポートの `schemaVersion` は別の契約として扱う。既存 `Report` を新しい型で置き換えず、trace の公開 API、同期処理、既存 JSON の出力は維持する。

## Risks / Trade-offs

- 最小入力を受け付けるだけでは評価済みにならない。生成・判定・履歴は W1-11（Issue #70）で仕様を追加し、このスキーマだけで PASS を返さない。
- 未知のフィールドを保持しても、それらの意味を定義したことにはならない。追加する項目の意味と互換条件は後続の仕様で決める。
- 版の欠落を既定値で補うと、不正な入力を受け付けてしまう。Zod と配布 JSON Schema の両方で欠落を拒否することを同一入力の試験で確認する。

## Migration Plan

今回はデータを生成・変換しない。既存の証跡や `schemaVersion: 2` のレポートを移行しない。新しい項目を追加する段階では、要件定義の互換性方針と整合させる。
