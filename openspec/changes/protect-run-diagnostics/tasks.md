# Tasks

## 1. 診断の保護

- [ ] 1.1 チャンク分割と末尾・長い単語の試験でRedを確認し、ストリームの置換を実装してGreenにする（REQ-153）
- [ ] 1.2 エンジンstderrとrunnerの表示・進捗の試験でRedを確認し、表示境界へ接続してGreenにする（REQ-153・REQ-154）

## 2. 統合検証

- [ ] 2.1 保護の範囲とTDD結果を記録し、changesetを追加して関連テストを通す
- [ ] 2.2 `pnpm -s verify --change protect-run-diagnostics --done` を通す <!-- loomake:gate=done -->
