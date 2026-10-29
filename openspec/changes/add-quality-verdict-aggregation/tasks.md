# Tasks

## 1. 仕様

- [x] 1.1 出典つき proposal・specs・design・trace を準備し、strict 検証と仕様ゲートを通す

## 2. 共有型と集約

- [x] 2.1 core の4値スキーマ・導出型・遅延 loader と ID 付き試験を追加し、4値と未知値・既存入口の保持を focused tests で確認する（REQ-305）
- [x] 2.2 kit の集約関数・API 説明・ID 付き試験を追加し、優先順位・境界・順序/重複・入力不変を focused tests で確認する（REQ-306）
- [x] 2.3 changeset と配布確認を追加し、新 API の tarball 入口・既存型/8 JSON の保持・lint・型チェックを確認する（REQ-305・REQ-306）

## 3. 完了確認

- [ ] 3.1 独立レビューと全体検証を行い、全タスクをチェックした最終 head の `pnpm -s verify --change add-quality-verdict-aggregation --done` を通す <!-- loomake:gate=done -->
