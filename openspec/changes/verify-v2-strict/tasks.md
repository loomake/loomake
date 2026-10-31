# Tasks

## 1. 仕様

- [x] 1.1 子changeを作り、親からREQ-164・317・318を既存IDのまま移す。承認事項をtraceに書く

## 2. ci-gate

- [ ] 2.1 `scripts/ci-gate.mjs`：`ciGateProblem` に対象のchangeとゲートを渡し、`verify --json` の結果で判定する。1.0.0・local・skip・要判断・partial・aborted・全件NOT_APPLICABLE・完了ゲートの検査を含まない結果・別のchangeの結果を合格にしない。子プロセスの試験で、それぞれを不合格にすることを確かめる（REQ-318）

## 3. runner

- [ ] 3.1 `reuse.ts`：Evidence 1は外部操作の再試行に再利用せず、新しい検証と記録に進む。旧ファイルは削除しない（REQ-164）
- [ ] 3.2 `phases.ts`・`decision-policy.ts`：完了ゲートにscope:ciの結果が来たら、エンジンを呼ばずに理由を記録して停止する（REQ-317）

## 4. trace

- [ ] 4.1 `evidenceProblem`：localのsummary.pendingがinsufficient以上であることを確かめる（REQ-164）

## 5. 受入

- [ ] 5.1 lint・typecheck・全体試験、文書（docs/dev/ci.md・互換性）、changeset（runner・trace patch）。`pnpm -s verify --change verify-v2-strict --done` を通す <!-- loomake:gate=done -->
