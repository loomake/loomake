# Tasks

## 1. 仕様

- [x] 1.1 子changeを作る。親 `verify-v2-c001` からREQ-205を移し、REQ-093は承認済みR-C001-05 AのMODIFIEDを確定する。どのRequirementを移すかは、2.0.0を読めることだけで満たせるかで決め、traceに理由を書く。`verify --spec-only` が0になることを確かめる

## 2. 読む側の対応

- [x] 2.1 kit：`formatVerifyResult` が2.0.0の結果も文にし、`isAbortedResult` を足す。1.0.0の出力は変えない
- [x] 2.2 runner：`decideAfterGate` に要判断とabortedの観測を足す。完了ゲート・仕様ゲート・recorder・prompt・PR本文・証拠の再利用が2.0.0とEvidence 2を読めるようにする。1.0.0とEvidence 1はこれまでどおり扱う（REQ-205・093）
- [x] 2.3 trace：`evidenceProblem` がEvidence 2を検査し、reportが正しいEvidence 2を読めるようにする
- [x] 2.4 `scripts/ci-gate.mjs`：純関数 `ciGateProblem` を足し、2.0.0のlocal・partial・要判断・abortedを合格として受け入れないことを試験する。実行の流れにはつながない

## 3. 受入

- [x] 3.1 受入：既存試験の期待値を変えないこと、lint・typecheck・全体の試験。changeset（kit・trace・runner patch）を足し、`pnpm -s verify --change verify-v2-readers --done` を通す <!-- loomake:gate=done -->
