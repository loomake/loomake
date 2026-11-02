# Proposal

## Why

Issue [#259](https://github.com/loomake/loomake/issues/259) の REQ-100 は、現 main の変更なし停止と、採用済み C001 の local/CI・要判断/aborted の扱いを併せて残す必要がある。元の C001・E3 差分を変更せず、現在の main に実装済みの条件だけを正式な差分仕様にまとめる。

## What Changes

- REQ-100 の本文を、Source 込み493文字の Tc に整合する。既存の全5 Scenario と `Source: REQ-100` はそのまま残す。
- 新しい停止規則・製品コード・試験・設定は追加しない。既存の実 run 回帰を、対応表に従って実行する計画にする。
- #259 は2子に分けたまま未完とする。REQ-340 と第6 Scenario を持つ T の子は、E3 最終統合 F の前に正式 change で確定する義務を残す。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `run`: REQ-100 に、採用済みの local 完了・CI 最終合格との区別・再修正判断と変更なし停止を整合する。

## Impact

対象は本 change の計画と差分仕様。main の主仕様への反映は後の sync/archive で行い、C001・E3・S1 の原文と PIN を保持する。#185 は Draft・実採集未完のまま、E3 の実装・規範を先に main へ入れない。
