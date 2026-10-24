# Tasks

## 1. 実行判断の分離
- [x] 1.1 エンジン終了・Git変更と完了ゲートの優先順位をRedから直接試験し、純粋関数を実装する（REQ-204・REQ-205）
- [ ] 1.2 エンジン後と完了ゲート後の処理を純粋関数へ接続し、既存の副作用の順序を保つ（REQ-204・REQ-205）
- [ ] 1.3 入力の不変性と逆転した規則の検出、既存の統合試験を確認する（REQ-206）

## 2. 統合検証
- [ ] 2.1 用語と責務、TDDの結果、changesetを更新する
- [ ] 2.2 `pnpm -s verify --change isolate-run-decisions --done` を通す <!-- loomake:gate=done -->
