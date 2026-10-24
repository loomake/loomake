## 1. 実装
- [x] 1.1 5 つの package.json に `repository`・`homepage`・`bugs`・`description`・`keywords` を書く（REQ-138）
- [x] 1.2 5 つのパッケージに README.md を置く（REQ-139）
- [x] 1.3 release ワークフローに品質コマンドと `concurrency` を足す（REQ-140）
- [x] 1.4 release ワークフローに `id-token: write` と npm の更新を足し、docs/release.md に初回と 2 回目以降の公開の手順を書く（REQ-141）

## 2. テスト
- [x] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [x] 3.1 `pnpm -s verify --change prepare-npm-publish --done` を通す
