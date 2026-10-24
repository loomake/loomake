# Tasks

## 1. 信号

- [x] 1.1 SIGTERM・SIGHUP の smoke 検査で Red を確かめ、CLI でこの 2 つも中断として扱う（REQ-208）

## 2. 統合検証

- [ ] 2.1 docs（run-recovery）と changeset を更新し、TDD の結果を tdd.md に記録する
- [ ] 2.2 `pnpm -s verify --change stop-engine-on-termination --done` を通す <!-- loomake:gate=done -->
