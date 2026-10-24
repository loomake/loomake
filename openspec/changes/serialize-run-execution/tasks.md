# Tasks

## 1. 実行の排他と記録

- [x] 1.1 排他・所有者の確認・終了済みロックの回復のテストでRedを確認し、ロックを実装してGreenにする（REQ-158・REQ-159）
- [ ] 1.2 実行中の二重起動と同秒の記録のテストでRedを確認し、runへ接続してGreenにする（REQ-158・REQ-160）

## 2. 統合検証

- [ ] 2.1 回復の手順と限界、TDD結果を記録し、changesetを追加して関連テストを通す
- [ ] 2.2 `pnpm -s verify --change serialize-run-execution --done` を通す <!-- loomake:gate=done -->
