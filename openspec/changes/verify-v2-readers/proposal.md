# Proposal: verify-v2-readers

## Why

C-001（親change `verify-v2-c001`）の2本目を、読む側の対応と書く側の切り替えの2つのPRに分けた。1つのPRの差分がOpusへの依頼の上限（200KiB）を超えたため（管理役の決定、2026-10-31）。この子changeは前半で、runner・trace・ci-gateが、verify 2.0.0の結果とEvidence 2を読めるようにする。書き出しは1.0.0とEvidence 1のままなので、mainでの振る舞いは変わらない。後半の子change `verify-v2-wiring` で書き出しを切り替える。出典は要件定義7.3、固定WBS v1.4の5章C-001、設計メモ（`.loomake/handoff/design-step8-c001-split-2026-10-31.md`）2.2。

## What Changes

- runner：純粋判断 `decideAfterGate` が、要判断（decision.required）と実行エラー（aborted）の観測を受け取り、直しに進まず止まる。完了ゲートの結果が2.0.0なら、scope:localの完了だけを完了とみなす。仕様ゲートの結果が2.0.0のabortedなら終了コード2・3で止まる。recorder・prompt・PR本文・証拠の再利用も2.0.0とEvidence 2を読める。1.0.0とEvidence 1はこれまでどおり受け付ける
- kit：`formatVerifyResult` が2.0.0も文にできる。2.0.0の結果がabortedかを見分ける `isAbortedResult` を足す
- trace：`evidenceProblem` がEvidence 2（verify 2.0.0）も検査する。正しいEvidence 2はreportで読める
- `scripts/ci-gate.mjs`：完了ゲートのJSONを合格として受け入れるかを判断する純関数 `ciGateProblem` を足す。2.0.0ではci・completed・要判断なし・PASSだけを受け入れ、1.0.0はこれまでどおり受け入れる。ci-gateの実行の流れにはつながない

## Non-goals

- 書き出しの切替、`runVerify` のscope、CLIのJSONと終了コード、trace recordのEvidence 2（`verify-v2-wiring`）
- 1.0.0とEvidence 1を合格や再利用の根拠にしないこと、ci-gateの流れの切替（`verify-v2-wiring`）
- reportの未対応の版の文言（REQ-073、`verify-v2-wiring`）

## Capabilities

### Modified Capabilities

- `run-decision-policy`：要判断・abortedで止まり、local完了を優先する純粋判断（REQ-205）
- `run`：仕様ゲートのabortedで2・3を返して止まる（REQ-093）

## Impact

対象は `packages/runner`・`packages/trace` の `evidence.ts`・`packages/kit` の `format.ts` と `scripts/ci-gate.mjs`。既存の公開名・試験の期待値・書き出しは変えない。changesetはkit・trace・runnerのpatch（追加だけ）。

Requirementは親から既存IDのまま移した。新しいREQ-IDは作らない。archiveは3本目のPRのあとに行う。
