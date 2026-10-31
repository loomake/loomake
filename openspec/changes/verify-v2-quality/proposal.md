# Proposal: verify-v2-quality

## Why

C-001（親change `verify-v2-c001`）を分けた5/6。verify-v2-shapeでquality.yamlの予算付き読取（`readQualityFile`）と品質条件の純粋判定（`evaluateQualityConditions`）を足したが、verifyはまだquality.yamlを読まない。そのため、`--done` のciは品質の実証跡を見ずに集約し、テストのレポートを古い結果や別の実行の結果と見分けない。この子changeで、`ci.test_report` の観測を作る純関数（adapter）を足し、`runVerify` をquality.yamlと品質判定につなぐ。正常はciのPASS/0、不正はaborted/2または3、不足はINSUFFICIENT_EVIDENCE/1を、同じCLIとAPIで返す。出典は要件定義7.3、設計メモ（design-step8b、2章の5/6）、親traceのR-C001-03・04・07・08・10の回答。

## What Changes

coreにはテストランナーのJSONレポートから、テストごとのstatus・要件ID・開始時刻を読む `parseTestReport` を足す。既存の `extractTestRequirements`（成功したテストだけを数える）の意味は変えない。

kitには`ci.test_report` のadapter `observeTestReport` を足す。producerと版、対象SHA、同じ実行の中で作られたレポートか（鮮度）、基準（quality.yaml・差分仕様・trace.md）と証跡（レポート）のhashを照合し、`QualityObservation` を返す。S1の判定moduleが再利用できるよう、I/O・環境・時計を読まない純関数にする（REQ-319）。

`runVerify` はquality.yamlを読む。不正はconfig（2）、不在・読取不能はruntime（3）、権限不足はpermission（3）のabortedを結果で返す。ciの完了検査では品質対象の検査（`quality:subjects`）と品質条件（`quality:<ID>`）をchecksに足して集約する（REQ-319）。zodを読まないkitへスキーマを渡すため、`VerifyOptions.qualitySchema` と `loadVerifyQualitySchema()` を足し、CLI・runner・trace recordはこれを渡す。

試験では正常PASS/0、不正aborted 2・3、不足1、置き残した古い結果（対象SHAや必須仕様を変えたあと）の拒否を、CLIとAPIで確かめる。成功例に手書きのok:trueや未照合の適格フラグを使わない。

## Non-goals

S1（信頼する基準側の判定器、private handoff、承認済みの期待値との照合）は扱わない。PRが実行前に要件を削った場合の検出も、S1の照合で扱う。検証計画（verification.yaml）と、実効script・config・lock・toolのhash（method）の照合も扱わず、S1の設計で型を決める。AGENTS.mdのDoDの文言と雛形（5b/6）、ci-gateがS1を呼ぶ接続（6/6）、`openspec/specs/` の直接編集も対象外とする。

## Capabilities

### Modified Capabilities

- `verify`（REQ-319。親changeのADDEDをそのまま移した）

## Impact

`--done` のci（scope省略時の既定）は、quality.yamlが必要になり、適格な実証跡がないとPASSにならない。localの完了検査と仕様の検査（spec-only）は、quality.yamlがあれば構造を確かめるだけで、品質の検査を足さない。runner・trace recordは `qualitySchema` を渡すように変える。archiveは6/6のあとに行う。
