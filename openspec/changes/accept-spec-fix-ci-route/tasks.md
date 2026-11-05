# Tasks

## 1. 仕様

- [x] 1.1 Opus 設計・回答済み trace・REQ-343 の差分をそろえ、strict と仕様ゲートを通す（REQ-343）

## 2. 条件の判定

- [x] 2.1 条件判定の REQ 付き単体試験を足し、RED を確認する（REQ-343）
- [x] 2.2 宣言・主仕様 Source・試験差分の判定を実装し、単体試験を通す（REQ-343）

## 3. CI への接続

- [ ] 3.1 子プロセスの REQ 付き試験を足し、現行 gate の RED を確認する（REQ-343）
- [ ] 3.2 gate に接続し、既存の期待値を変えず契約・プロセス試験を通す（REQ-343）
- [ ] 3.3 CI ガイドへ機械条件・レビュー項目と単発の時間切れの事実を記し、文書リンクの試験を通す（REQ-343）

## 4. 統合の確認

- [ ] 4.1 lint・型・全試験・主仕様 strict・REQ 重複検査を通し、作業記録を残す（REQ-343）
- [ ] 4.2 `pnpm -s verify --change accept-spec-fix-ci-route --done --scope local` を通す（REQ-343） <!-- loomake:gate=done -->

最終の合格は PR の scope ci 完了ゲート・必須 CI・3 OS・独立レビューで確かめる。

## Workflow follow-up

- main に入った実装と対応試験、CI の成功を確認してから、正式 CLI の仕様同期と archive を進める。
