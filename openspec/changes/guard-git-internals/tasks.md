# Tasks

## 1. ガード

- [ ] 1.1 フックと設定の書き換えのテストで Red を確かめ、エンジンを呼ぶ前後で git の設定とフックを比べて止まる（REQ-198）
- [ ] 1.2 秘密情報の形のテストで Red を確かめ、置換する形を足す（REQ-199）

## 2. 統合検証

- [ ] 2.1 docs（security）と changeset を更新し、TDD の結果を tdd.md に記録する
- [ ] 2.2 `pnpm -s verify --change guard-git-internals --done` を通す <!-- loomake:gate=done -->
