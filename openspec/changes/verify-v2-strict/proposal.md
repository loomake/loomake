# Proposal: verify-v2-strict

## Why

C-001（親change `verify-v2-c001`）を6つのPRに分けた2c/6。2b-1/6と2b-2/6で、verifyは2.0.0を書き出し、Evidenceの現行の名前は2になった。ただし、ci-gateはまだverifyの終了コードだけで合格を決め、runnerは旧Evidence 1を外部操作の再試行に再利用し、完了ゲートにscope:ciの結果が来ても直しに進む。この子changeで旧形式とlocalの結果を最終合格や再利用の根拠から外す。出典は要件定義7.3、設計メモ2.2、管理役の分割の決定（2026-10-31）。

## What Changes

- ci-gate（REQ-318）：`verify --done` を `--json` で実行し、2a/6で足した判断関数 `ciGateProblem` を実行の流れにつなぐ。対象のchangeとゲート（done / spec-only）で判定し、1.0.0・local・skip（証拠不足）・要判断・partial・aborted・検査0件や全件NOT_APPLICABLE・完了ゲートの検査を含まない結果（仕様ゲートや品質コマンドだけの結果）を、終了コードが0でも合格にしない
- runner（REQ-164）：証拠の再利用はEvidence 2のlocal完了に限る。直前の証拠がEvidence 1なら再利用せず、新しい検証と記録を行う。旧ファイルは削除しない。読むこと（report）はできる
- runner（REQ-317）：完了ゲートにscope:ciの結果が来たら、再修正のエンジンを呼ばずに理由を記録して停止する。完了ゲートは `--scope local` に固定したまま
- trace：`evidenceProblem` が、localのsummary.pendingがinsufficient以上であることを確かめる

## Non-goals

- `--scope` のCLIフラグ、実証跡のadapter、PR本文の表示の変更、規約・雛形の更新（6/6）
- 1.0.0・Evidence 1の閲覧（report）をやめること

## Capabilities

### New Capabilities

- `monorepo`（REQ-318、親からADDEDのまま移す）
- `run-decision-policy`（REQ-317、親からADDEDのまま移す）

### Modified Capabilities

- `run`（REQ-164）

## Impact

既存試験の期待値は、ci-gateの偽のverifyが `--json` を受けて2.0.0のJSONを出す箇所と、`ciGateProblem` が1.0.0を受け入れなくなる箇所だけを変える。archiveは6/6のあとに行う。
