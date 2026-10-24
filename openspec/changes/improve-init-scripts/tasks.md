# Tasks

## 1. init

- [ ] 1.1 script の有無のテストで Red を確かめ、ある script のコマンドだけを commands に書く（REQ-196）
- [ ] 1.2 テストランナーの判定のテストで Red を確かめ、使っているテストランナーの設定例だけを表示する（REQ-197）

## 2. 統合検証

- [ ] 2.1 docs（for-agents）と changeset を更新し、TDD の結果を tdd.md に記録する
- [ ] 2.2 `pnpm -s verify --change improve-init-scripts --done` を通す <!-- loomake:gate=done -->
