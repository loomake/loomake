## 1. 実装
- [ ] 1.1 完了ゲートに合格したあとに、gh の確認・証拠の記録とコミット・ブランチの送信をする（REQ-114、REQ-116）
- [ ] 1.2 PR の本文を作り、gh pr create で PR を作る（REQ-115、REQ-116）

## 2. テスト
- [ ] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる。origin は一時ディレクトリの bare リポジトリにし、gh は偽のコマンドを使う

## 3. 確認
- [ ] 3.1 `pnpm -s verify --change add-run-pr --done` を通す
