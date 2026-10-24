# Tasks

## 1. ガード

- [x] 1.1 フックと設定の書き換えのテストで Red を確かめ、エンジンを呼ぶ前後で git の設定とフックを比べて止まる（REQ-198）
- [x] 1.2 秘密情報の形のテストで Red を確かめ、置換する形を足す（REQ-199）

## 2. 統合検証

- [x] 2.1 docs（security）と changeset を更新し、TDD の結果を tdd.md に記録する
- [x] 2.2 `pnpm -s verify --change guard-git-internals --done` を通す <!-- loomake:gate=done -->

## 3. 形式が隣接する保存ログ

- [x] 3.1 APIトークンに秘密鍵ブロックが隣接する回帰でRedを確認し、ブロックを先に置換し、JSONの値も保護してGreenにする（REQ-199）
- [ ] 3.2 結果を記録し、`pnpm -s verify --change guard-git-internals --done` を通す <!-- loomake:gate=done -->
