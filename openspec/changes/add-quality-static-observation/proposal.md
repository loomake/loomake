# Proposal

## Why

W1-11の手動評価は、既存品質コマンドの出力から品質指標を観測する共通処理を必要とする。Issue #70の縮小決定と追加Opus設計の分割案に従い、純粋な静的観測だけを独立して受け入れる。

## What Changes

- kitに `observeStaticMetrics` と入力receipt型を追加する。今回のテスト成否・件数とcoverageの実出力だけを製品品質の観測へ変換する。
- 出典・対象・品質基準・実行時刻・出力hashを照合し、古い出力や実行ゼロを成功値にしない。
- lint・型検査のerror_countは取得不能として未評価にし、終了コードから件数を推定しない。

## Capabilities

### New Capabilities

- `quality-evaluation`: 既存品質コマンドの静的指標を、測定した値と未評価の理由に分ける。

### Modified Capabilities

なし。

## Non-goals

CLI eval、コマンドの実行、要求待機と追跡、失敗試行の保存、history・索引とstatusは含めない。C2 `trace-static-evaluation` とC3 `add-quality-status-report` が引き続き担当する。既存品質設定・公開JSON・依存の範囲・試験の期待値は変えない。本changeの受入は#70全体の完了ではない。

## Impact

`packages/kit/src/verify/policy/`、kitのnamed export、REQ-430の試験、静的指標の利用ガイド、changeset。既存の純粋な `QualityObservation` とcoreのテストレポート解析を再利用する。
