## 1. 実装
- [ ] 1.1 ci-gate で、PR 本文の明示・変えたファイル・ブランチ名から対象の change を決める（REQ-132）
- [ ] 1.2 ci-gate で、対象ごとに完了ゲートを実行し、特定できないときの扱いを分ける（REQ-132）
- [ ] 1.3 CI のワークフローで、PR 本文と向き先のブランチを ci-gate に渡し、PR 本文の編集でも完了ゲートを実行し直す（REQ-132）

## 2. テスト
- [ ] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [ ] 3.1 `pnpm -s verify --change make-ci-change-selection-explicit --done` を通す
