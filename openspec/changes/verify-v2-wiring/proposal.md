# Proposal: verify-v2-wiring

## Why

C-001（親change `verify-v2-c001`）を6つのPRに分けた2b-1/6。2a/6 `verify-v2-readers` で読む側を2.0.0に対応させた。この子changeでverifyの書き出しを2.0.0にし、trace recordをEvidence 2で書き出す。出典は要件定義7.3、設計メモ2.2、管理役の分割の決定（2026-10-31）。

## What Changes

- **BREAKING** core：`VerifyResult`・`verifyResultSchema`・`VERIFY_RESULT_SCHEMA_VERSION` と `schema/verify-result.schema.json` を2.0.0にする。1.0.0は履歴の名前と版付きパスで残す。Evidenceの現行の名前はEvidence 1のまま
- **BREAKING** kit：`runVerify` が2.0.0を返し、scopeを受け取る（省略時は完了ゲートがci、ほかはlocal）
- **BREAKING** CLI：`verify --json` は2.0.0を出し、終了コードは `verifyExitCode`。`--json` では使い方と設定の誤りもabortedを出す
- **BREAKING** trace：`runRecord` はscope（省略時ci）を受け取り、Evidence 2で記録する
- runner：完了ゲートと記録をscope:localにする

## Non-goals

- Evidenceの現行の名前、reportの不正箇所の表示（REQ-073）、互換性の文書、root `quality.yaml`（2b-2/6）
- ci-gateの流れへの接続、旧形式の不合格、ciの結果での停止（2c/6）
- `--scope` のCLIフラグとquality.yamlの判定の接続（6/6）

## Capabilities

### Modified Capabilities

- `verify`（REQ-040・041・311）、`trace-record`（REQ-315）、`run`（REQ-100）

## Impact

既存試験の期待値は、JSONの形・終了コード・Evidenceの版を変える箇所だけを変える。archiveは6/6のあとに行う。
