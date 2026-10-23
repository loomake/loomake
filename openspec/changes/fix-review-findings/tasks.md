## 1. 実装
- [x] 1.1 ci-gate で `loomake/<change-id>` のブランチ名から change-id を取り出す（REQ-010）
- [x] 1.2 エンジンが 0 以外の終了コードで終わったら、タスクを完了にせずに止まる（REQ-099）
- [x] 1.3 既存の `loomake/<change-id>` に切り替えてから、仕様ゲートとタスクの読み取りを行う（REQ-096）
- [x] 1.4 すべての package.json の `scripts` の変更を検出する（REQ-110）
- [ ] 1.5 trace.md の表に必須の列がないときに解析エラーにする（REQ-011）
- [ ] 1.6 PR の向き先を git config に覚え、再開のときに使う（REQ-114）

## 2. テスト
- [ ] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [ ] 3.1 `pnpm -s verify --change fix-review-findings --done` を通す
