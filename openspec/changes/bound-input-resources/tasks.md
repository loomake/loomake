# Tasks

## 1. 共通の入力境界

- [x] 1.1 探索・リンク・読み取り量と合計・型・解放のテストでRedを確認し、共通readerを実装してGreenにする（REQ-170・REQ-171）
- [ ] 1.2 verify・trace・runの入力制限と停止の回帰テストでRedを確認し、共通readerへ接続してGreenにする（REQ-172）

## 2. 文書と統合検証

- [ ] 2.1 入力予算と対象外の範囲、測定・TDD結果とchangesetを記録し、関連テスト・型・lintを通す
- [ ] 2.2 `pnpm -s verify --change bound-input-resources --done` を通す <!-- loomake:gate=done -->
