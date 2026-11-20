# 手書きの効率記録と実績記録を読み、9列の表にまとめる

## Why

Issue #68（W1-9）の完了条件は、change ごとに推定と実績が表に出ることである。PR1（effort-record）と PR2a（effort-record-hardening）で実績の記録の入口と検査は整った。次に、手書きの記録（`docs/effort/*.md`）と `record --effort` の記録を読み、要件定義 7.8 の 9 列で集計する。

## What Changes

- 新しい capability `effort-summary` に REQ-467（読取り）と REQ-468（集計と整形）を加える。
- REQ-171（bounded-input）に、置換 decode をしない bytes の読取りを加える。
- core に `readTable` を公開し、`TableRow` に `size` を足す。kit に `createByteInputReader` を足す。
- trace に `readEffortInputs`・`parseManualEffort`・`buildEfficiencyTable`・`formatEfficiencySection` を公開する。いずれも追加だけで、既存の公開 API は変えない。

## Non-goals

単独の表 CLI と、人力工数の自動推定（FR-49、W7）は作らない。品質状況レポートへの接続（REQ-469）は #70 の後の PR3。人力実測を記録する様式の欄は足さない。C-001 の実績と C-002/C-003 の原本は利用者の回答待ちで、実データの受入は親 #68 に残す。公開 JSON Schema、CLI の文法、既存の record・runner・実記録原本は変えない。

## Impact

core の入口（`readTable`）、kit の入力 reader、trace の新規ファイル `effort-manual.ts`・`effort-summary.ts`、試験、移行不要の追加 API。core・kit・trace は minor の changeset とする。
