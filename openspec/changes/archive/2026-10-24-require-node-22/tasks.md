## 1. 実装
- [x] 1.1 ルートと 5 つの package.json の `engines.node` を `>=22.12.0` にする（REQ-142）
- [x] 1.2 CI の `node20` ジョブを `node22` ジョブにする（REQ-142）
- [x] 1.3 README・docs/usage.md・AGENTS.md・パッケージの README の下限を 22.12 に直す

## 2. テスト
- [x] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [x] 3.1 `pnpm -s verify --change require-node-22 --done` を通す
