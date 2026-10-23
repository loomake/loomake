## 1. 実装
- [x] 1.1 ci-gate で、PR 本文の明示・変えたファイル・ブランチ名から対象の change を決める（REQ-132）
- [x] 1.2 ci-gate で、対象ごとに完了ゲートを実行し、特定できないときの扱いを分ける（REQ-132）
- [x] 1.3 CI のワークフローで、PR の番号と向き先のブランチを ci-gate に渡し、ci-gate が PR 本文を gh で読む（REQ-132）

## 2. テスト
- [x] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [x] 3.1 `pnpm -s verify --change make-ci-change-selection-explicit --done` を通す
