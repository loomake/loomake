# Proposal: verify-v2-wiring

## Why

C-001（親change `verify-v2-c001`）を5つのPRに分けた2b/5。2a/5 `verify-v2-readers` で、runner・trace・ci-gateが2.0.0とEvidence 2を読めるようにした。この子changeでは、書き出しを2.0.0とEvidence 2へ切り替える。旧形式を不合格にする変更は2c/5、正常PASSの受入は5/5（親）で行う。出典は要件定義7.3、固定WBS v1.4のJ02・J03と5章C-001、設計メモ2.2、管理役の分割の決定（2026-10-31）。

## What Changes

- **BREAKING** core：現行の `VerifyResult`・`verifyResultSchema`・`VERIFY_RESULT_SCHEMA_VERSION` を2.0.0、`Evidence`・`evidenceSchema`・`EVIDENCE_SCHEMA_VERSION` を2にする。版付きでない `schema/verify-result.schema.json`・`schema/evidence.schema.json` も現行版にし、`schema-history/2.0.0.json` を足す。1.0.0とEvidence 1は履歴の名前と版付きパスで残す
- **BREAKING** kit：`runVerify` が2.0.0を返し、scope（省略時は完了ゲートがci、仕様ゲートとchangeなしがlocal）を受け取る。結果を組み立てる側で、partialのciにPASSを出さず、localのpartialでは未完了を1以上にする。`--skip-commands` では前回のレポートを今回の成功の一覧に使わない
- **BREAKING** CLI：`verify --json` は2.0.0を出し、終了コードを `verifyExitCode` で決める。単独の `--json` があれば、使い方と設定の誤りもabortedのJSONを出す
- **BREAKING** trace：`runRecord` はscope（省略時ci）を受け取り、Evidence 2で記録して、verifyと同じ終了コードを返す
- trace：reportはEvidence 1とEvidence 2を受け付け、未対応の版、版の混在、状態別の必須欄の欠けを、その箇所を示して拒否する
- runner：完了ゲートと証拠の記録をscope:localに固定する
- root `quality.yaml` を置く（承認済みR-C001-07 Aの初期内容）。verifyへの接続は5/5
- changeset：core・kit・trace・CLIはminor、runnerはpatch

## Non-goals

- ci-gateを実行の流れにつなぎ、local・旧1.0.0・skip・spec-only・全件NOT_APPLICABLEを不合格にすること、Evidence 1を再利用しないこと、ciの結果で停止すること（2c/5）
- `--scope` のCLIフラグ、help、CLIリファレンス、quality.yamlの判定の接続（5/5）

## Capabilities

### Modified Capabilities

- `verify`：2.0.0の書き出し、JSON出力、終了コード（REQ-040・041・311）
- `trace-record`：Evidence 2の記録（REQ-315）
- `trace-report`：Evidence 1・2の受け付けと拒否（REQ-073）
- `run`：完了ゲートをlocalにする（REQ-100）

## Impact

対象はcore・kit・trace・CLIとrunnerの完了ゲート、配布物の検査。既存試験の期待値は、JSONの形・終了コード・Evidenceの版を変える箇所だけを変え、根拠のREQをPR本文の表に書く。Requirementは親から既存IDのまま移した。REQ-042は本文を変えずに満たす。archiveは5/5のあとに行う。
