# Tasks

## 1. 既定の上限

- [ ] 1.1 既定値の整合のテストで Red を確かめ、エンジンの出力の既定の上限を 16MiB にする（REQ-151・REQ-210）

## 2. 統合検証

- [ ] 2.1 docs（resources）と changeset を更新し、TDD の結果を tdd.md に記録する
- [ ] 2.2 `pnpm -s verify --change align-output-and-log-budgets --done` を通す <!-- loomake:gate=done -->
