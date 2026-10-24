# Tasks

## 1. 証拠とPRの再試行

- [x] 1.1 push・PR失敗後の証拠再利用と不正候補、既存PRと検索失敗のテストでRedを確認し、再試行を実装してGreenにする（REQ-164・REQ-165）
- [x] 1.2 再検証の不合格・HEADと作業ファイルの変更の試験でRedを確認し、状態を保護してGreenにする（REQ-166）

## 2. 統合検証

- [ ] 2.1 復旧手順と限界・TDD結果・changesetを記録し、型・lint・関連テストを通す
- [ ] 2.2 `pnpm -s verify --change resume-pr-publication --done` を通す <!-- loomake:gate=done -->
