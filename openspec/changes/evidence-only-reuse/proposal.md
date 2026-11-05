# 証跡だけの変更で要約を再利用する

## Why

Issue #458 の A17 は、証跡の追加だけのコミットで品質コマンドを重ねて起動せず、外部で凍結した信頼値との整合性を確認する入口を求める。一次要約の改変は人へ差し戻し、コードの混在や環境の相違は実際の再検証へ切り替える。

## What Changes

- kit に Git 原本の各コミットのメタデータを読む readEvidenceRange と共有予算の createGitEvidenceReader を追加する。
- trace に runReuse と ReuseRecord の型・検証を追加し、再利用・再検証・人への差し戻し・停止を区別する。
- CLI に trace reuse と5つのオプションを追加する。既存CLIの基準との差分は Q-08 の範囲で記録し、共通定義からリファレンスを生成する。
- REQ-473〜476 を追加し、REQ-323 の操作一覧を更新する。

## Capabilities

### New Capabilities

- evidence-reuse: 証跡だけの変更における整合性確認と再検証への切替え。

### Modified Capabilities

- reference-docs: trace reuse の公開定義を参照ページへ追加する。

## Impact

kit・trace・loomake の非破壊の入口追加。ADR 0002 に従い3パッケージを patch とする。依存方向は既存どおりとし、core の13個の JSON Schema は変更しない。

## Non-goals

runner と runVerify の既定、skip の不足、CI・完了ゲート・独立レビュー・設定は変更しない。anchor の取得・真正性・hardlinkや別マウント経路の検出、release、#69/#70 の完成扱いは対象外。品質の最終合格を再利用の記録で代替しない。

## Archive dependency

REQ-323 は有効な verify-v2-scope の全文を基にする。archive は verify-v2-scope の後に行い、本 change から他者の change は archive しない。
