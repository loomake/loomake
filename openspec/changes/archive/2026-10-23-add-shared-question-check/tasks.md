## 1. 実装
- [x] 1.1 仕様ゲートに、同じ確認事項の回答を比べる検査を足す（REQ-034）
- [x] 1.2 docs/usage.md と docs/for-agents.md の検査の一覧に、新しい検査を足す

## 2. テスト
- [x] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる。change は一時ディレクトリに作る

## 3. 確認
- [x] 3.1 `pnpm -s verify --change add-shared-question-check --done` を通す
