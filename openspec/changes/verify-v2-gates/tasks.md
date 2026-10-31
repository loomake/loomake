# Tasks

## 1. 仕様

- [x] 1.1 子changeを作り、親からREQ-036・037・038・039・191・203を既存IDのまま移し、R-C001-08 Bの規範に本文を確定する。親の台帳・tasksに移したことを書く。`verify --change verify-v2-gates --spec-only` が0

## 2. 分類

- [ ] 2.1 `run.ts`：doneの未承認の仮定と確認待ちを不足にし、`decision`（APPROVAL_REQUIRED）を組み立てて結果に載せる。spec-onlyは案内PASSのまま0（REQ-036・038）
- [ ] 2.2 `run.ts`：auto設定でOpenSpec CLIが無いとき、localは理由と確認者つきのNOT_APPLICABLE、ciは不足にする。明示trueは不合格のまま（REQ-037）
- [ ] 2.3 未知キーの案内PASS、`--skip-commands` の不足1、spec-onlyで品質項目を数えないことを、local・ciで試験する（REQ-039・191）
- [ ] 2.4 仮定の承認後に案内・不足・要判断理由から消えることを試験し、利用者向けの語を案内/不足に揃える（REQ-203）

## 3. 受入

- [ ] 3.1 lint・typecheck・全体試験、docs/guide のwarnの説明。`pnpm -s verify --change verify-v2-gates --done` を通す <!-- loomake:gate=done -->
