# Tasks

## 1. 診断の保護

- [x] 1.1 チャンク分割と末尾・長い単語の試験でRedを確認し、ストリームの置換を実装してGreenにする（REQ-153）
- [x] 1.2 エンジンstderrとrunnerの表示・進捗の試験でRedを確認し、表示境界へ接続してGreenにする（REQ-153・REQ-154）

## 2. 統合検証

- [x] 2.1 保護の範囲とTDD結果を記録し、changesetを追加して関連テストを通す
- [x] 2.2 `pnpm -s verify --change protect-run-diagnostics --done` を通す <!-- loomake:gate=done -->

## 3. 追加された既知形式の診断保護

- [x] 3.1 Bearerと秘密鍵ブロックの回帰でRedを確認し、有限の状態で転送前の置換を修正する（REQ-153）
- [x] 3.2 実stderrと配布物のメモリ試験で保護を確認し、通常の診断を保つ
- [x] 3.3 実行結果と文書・changesetを更新し、`pnpm -s verify --change protect-run-diagnostics --done` を通す <!-- loomake:gate=done -->
