# Tasks

## 1. モデルとルール

- [x] 1.1 モデル変換と合意判定のテストでRedを確認し、coreの純粋APIを実装してGreenにする（REQ-147・REQ-148）
- [x] 1.2 要件とテストの対応のテストでRedを確認し、純粋APIを実装してGreenにする（REQ-149）
- [ ] 1.3 verifyの不正IDのテストでRedを確認し、モデルと純粋判定へ接続して既存の判定も検証する（REQ-150）

## 2. 統合検証

- [ ] 2.1 用語と責務の境界、TDD結果を記録し、changesetを追加して関連テストを通す
- [ ] 2.2 `pnpm -s verify --change separate-verification-policy --done` を通す <!-- loomake:gate=done -->
