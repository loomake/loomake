# Proposal: verify-v2-evidence

## Why

C-001（親change `verify-v2-c001`）を6つのPRに分けた2b-2/6。2b-1/6 `verify-v2-wiring` で、trace recordはEvidence 2を書くようになった。ただし、Evidenceの現行の名前はまだEvidence 1を指している。この子changeで現行の名前をEvidence 2に切り替え、trace reportが壊れたEvidence 2の不正箇所を示すようにする。出典は要件定義7.3、設計メモ2.2、管理役の分割の決定（2026-10-31）。

## What Changes

- **BREAKING** core：`Evidence`・`evidenceSchema`・`EVIDENCE_SCHEMA_VERSION`・`schema/evidence.schema.json` を、Evidence 2（verify 2.0.0を含む）にする。Evidence 1は `LegacyEvidence`・`legacyEvidenceSchema`・`LEGACY_EVIDENCE_SCHEMA_VERSION` と版付きパスで残す
- trace report：未対応の版、証拠とverifyの版の混在、Evidence 2の状態別の必須欄の欠けを、ファイルと不正な箇所を示して終了コード2で止める。壊れたEvidence 2を「読めるのは1」と案内しない（REQ-073）
- CLI：`verify --skip-commands` のhelpの説明を、REQ-040の動き（レポートを読まず、その項目を証拠不足にして終了コード1）に合わせる。基準mainの原本は書き換えず、承認した差分を別ファイルに記録する（REQ-324）
- 互換性の文書に移行と型の名前を書き、root `quality.yaml` を置く

## Non-goals

- ci-gateを流れにつなぎ旧形式を不合格にすること（REQ-318）、REQ-164・317、evidenceProblemのpending≥insufficient（2c/6）
- `--scope` のCLIフラグ、quality.yamlの判定への接続（6/6）

## Capabilities

### Modified Capabilities

- `trace-report`（REQ-073）、`reference-docs`（REQ-324）

## Impact

既存試験の期待値は、Evidenceの現行の版と、reportの案内の文言と、verifyのhelpの1行を変える箇所だけを変える。archiveは6/6のあとに行う。
