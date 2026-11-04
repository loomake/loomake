# Proposal

## Why

Vitestのtimeout後に続く古いcallbackからbodyを呼ぶと、閉じた試行の記録が増えたり、次のretryの証拠へ混ざったりする（Issue #376）。#278の後続判定へ接続する前に、試行の出どころと閉じる時点を明確にする。

## What Changes

- REQ-393を改訂し、Vitest 5.0.5の試行ごとの実行範囲から得た識別情報でbodyの帰属を決める。終了済み試行からの遅い初回・2回目の呼出しは、記録を開き直さない。
- kitの公開入口へ`createBodyRunner(Base)`を追加する。利用側が持つrunnerと設定で導入し、既存の`createBodyRecorder(chai)`と`body(ctx, fn)`の呼出しを保つ。
- **BREAKING**：runner統合が未設定ならfnを1回実行して元の値・例外・非同期完了を保ち、証拠を作らない。利用者の直接回答に従い、既存利用側へ設定方法と移行の影響を案内する。
- `format:1`、5つの既存Scenario、52件の基準fixtureを保つ。Issue #376の未検証だったattemptsを実観測で確定し、遅い呼出し・モジュール分離・公開consumerの回帰試験を加える。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `test-body-evidence`：REQ-393の試行境界、公開runner統合、未設定時の証拠なしと移行案内を明示する。

## Impact

対象はkitの取得器・公開export、対応する試験、配布物consumer、互換性ガイドとchangeset。coreの証拠形式・JSON、CLI、#278のreader/gate、initテンプレート、公開・リリースは変更範囲に含めない。kitへVitestの実行時依存は追加しない。

このchangeは計画段階であり、実装・実測oracleの確定・完了ゲート・CI・独立実装レビューは未完。既存の実装担当を維持する。
