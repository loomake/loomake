# Tasks

## 1. 配布物の検証

- [x] 1.1 配布物を準備・検査する統合テストでRedを確認し、スクリプトと公開exportsを実装してGreenにする（REQ-143・REQ-146）
- [ ] 1.2 CIと公開前ゲートのテストでRedを確認し、ワークフローへ配布物検査を追加してGreenにする（REQ-144・REQ-145）

## 2. 統合検証

- [ ] 2.1 検証手順とTDD結果を記録し、changesetを追加して関連テストを通す
- [ ] 2.2 `pnpm -s verify --change verify-package-artifacts --done` を通す <!-- loomake:gate=done -->
