# Tasks

## 1. ガード

- [ ] 1.1 include の先の設定とリンク先のないフックのテストで Red を確かめ、git が使う設定とフックのリンクを比べる（REQ-204）
- [ ] 1.2 import とコメントを消すテストで Red を確かめ、検査の行の数え方を直す（REQ-201）

## 2. 統合検証

- [ ] 2.1 docs（security）と changeset を更新し、TDD の結果を tdd.md に記録する
- [ ] 2.2 `pnpm -s verify --change fix-guard-review-findings --done` を通す <!-- loomake:gate=done -->
