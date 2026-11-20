# Tasks

## 1. 仕様

- [x] 1.1 trace・REQ-477 の追加と REQ-343 の差分をそろえ、strict と仕様ゲートを通す（REQ-477、REQ-343）

## 2. 条件の判定

- [x] 2.1 条件判定の REQ 付き単体試験を足し、RED を確認する（REQ-477）
- [ ] 2.2 宣言・`openspec/`・既存のテストファイル・独立レビューの証跡の判定を実装し、単体試験を通す（REQ-477）

## 3. CI への接続

- [ ] 3.1 子プロセスの REQ 付き試験を足し、現行 gate の RED を確認する（REQ-477、REQ-343）
- [ ] 3.2 gate に接続し、既存の期待値を変えずに spec-fix・契約・プロセスの試験を通す（REQ-477、REQ-343）
- [ ] 3.3 `docs/dev/ci.md`・`AGENTS.md`・PR テンプレートに経路と関数の書き方の規則を記し、文書リンクの試験を通す（REQ-477）

## 4. 統合の確認

- [ ] 4.1 lint・型・全試験・REQ 重複検査を通し、作業記録を残す（REQ-477、REQ-343）
- [ ] 4.2 `pnpm -s verify --change accept-refactor-ci-route --done --scope local` を通す（REQ-477、REQ-343） <!-- loomake:gate=done -->

最終の合格は PR の scope ci 完了ゲート・必須 CI・3 OS・独立レビューで確かめる。
