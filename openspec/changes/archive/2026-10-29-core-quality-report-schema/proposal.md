# Proposal: core-quality-report-schema

## Why

Issue #60 の残作業である quality-report の契約を、既存のリリースレポートと区別して追加する。持ち主は最小契約を先に定める方針に続き、本会話で「推奨案を承認：version: 1のみ必須にする」と回答した。承認の記録は trace.md の Q-01 に残す。

## What Changes

- Q-01 の回答に従い、必須項目を数値の `version: 1` だけとする quality-report の Zod スキーマ、導出型、JSON Schema を core へ追加する。
- 未知のフィールドは拒否せず、解析結果に値を変えずに残す。
- 日時・評価対象・結果の具体的な項目と、生成・評価処理は W1-11（Issue #70）で追加する。
- 初版の公開定数を `1` とし、スキーマは必要なときに遅延ロードする。`version` の省略へ既定値を補わない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `core-parsers`: quality-report の初期契約を追加する（REQ-301）。

## Non-goals

- 既存の `Report`、`REPORT_SCHEMA_VERSION = 2`、`trace report --format json` の形式を変更しない。
- 証跡と既存レポートの Zod 移行（旧 REQ-280）、trace.md・spec・tasks の移行（REQ-298〜300）は別作業とする。
- W1-11 の評価、quality-report.json の生成、履歴への追記、状況レポートの生成は実装しない。これらの完了条件も変更しない。

## Impact

`packages/core/` のスキーマ・型・JSON Schema の書き出しと対応試験を変更する。公開入口と配布物の検証、利用案内を追加する。外部依存の追加や既存の trace の JSON 出力の変更は行わない。
