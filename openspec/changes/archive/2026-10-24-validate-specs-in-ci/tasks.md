## 1. 実装
- [x] 1.1 CI の gate ジョブで、いまの仕様に `openspec validate --specs --strict` を実行する（REQ-010）

## 2. テスト
- [x] 2.1 Scenario に対応するテストを、実装の前に書いて落ちることを確かめる。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [x] 3.1 `pnpm -s verify --change validate-specs-in-ci --done` を通す <!-- loomake:gate=done -->
