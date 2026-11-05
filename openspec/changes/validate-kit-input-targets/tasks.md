## 1. 入力と停止の修理

- [ ] 1.1 report の正規化・共通の対象検査・明示値と既定値の検査・削除直前の再検査を実装し、外部ファイルを保つ回帰を確認する（REQ-424・172）
- [ ] 1.2 init の全置き先の種類と実効 report を事前検査し、gitignore の文字どおりの行と doctor の案内を共通化して回帰を確認する（REQ-425・426・133）
- [ ] 1.3 監視役の親側の期限と結果なしのtimeout・後片付け・後続停止を実装し、長い期限と正常な結果も保つ回帰を確認する（REQ-250・428・180・181・183）
- [ ] 1.4 change の lstat エラーの分類と cause を直し、ENOENT・ENOTDIR・EACCES・ELOOP の回帰を確認する（REQ-172）

## 2. 配布と記録

- [ ] 2.1 changeset と日別worklogを追加し、型・lint・対象試験の結果と要件対応を確認する

## 3. 完了ゲート

- [ ] 3.1 `pnpm -s verify --change validate-kit-input-targets --done --scope local` を通し、全要件と全タスクを確認する <!-- loomake:gate=done -->

## Workflow follow-up

同期・archive は同じPRに含める。最終headのCI完了ゲート・必須チェック・3OS・独立レビューは本体が確認する。
