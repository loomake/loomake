# Design

## Context

親 `trace-static-evaluation` の静的観測task 2.1はf78aed5cで実装済み。Opus初回463f483a・補足e7dfacf6・追加79b4d2aaの設計と、管理役が採用した通常の独立子change3本への分割に従い、REQ-430とその成果だけを移す。C1をarchiveしたあと、親はREQ-430を既存仕様で充足へ変更する。

## Goals / Non-Goals

純粋な観測関数をkitへ追加し、品質基準で指定された製品品質の静的source/metricだけを返す。呼出側のI/O・コマンド実行・保存・時計・品質判定は本changeの外とする。利用時品質へ製品品質の観測を流用しない。

## Decisions

- receiptは呼出側が今回の実行から集める事実であり、producerの名前と版、前後のcommitと基準hash、実行時刻、前回出力の削除、コマンド結果、出力本文とhashを持つ。呼出側がhash関数を渡し、観測関数は入力を変えない。
- 既知のVitest/Jestレポートをcoreで解析し、passedとfailedだけを実施件数にする。未実施、実行できなかったファイル、今回範囲外の時刻、本文hash不一致、対象/基準の変化は測定値にしない。
- coverageは今回の既存集計にある有限の0〜100の割合と正の対象数だけを使う。欠落・不正・Unknownを0へ変えない。
- error_countは既存出力から件数を得られないため、コマンドの成功/失敗にかかわらずunavailable・valueなしとする。未設定はnot_run。nonzero_exitを追加指標にせず、非対応source/metricは観測を作らない。
- 公開入口はnamed exportだけを追加する。公開8JSON Schemaと既存依存は変えない。

## Risks / Trade-offs

receiptの収集は後続C2の責務であり、この関数だけでは実コマンドを評価できない。coverageの時刻は呼出側が前回出力を削除した事実によって照合する。未取得は未評価として保持し、値を作るために品質設定を変えない。
