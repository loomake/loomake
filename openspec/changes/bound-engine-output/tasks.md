# Tasks

## 1. 出力の制限

- [x] 1.1 stdout・stderr・UTF-8境界の回帰テストでRedを確認し、収集と転送を制限してGreenにする（REQ-151）
- [ ] 1.2 設定とrunnerの停止結果の回帰テストでRedを確認し、未完了と報告を検証してGreenにする（REQ-152）

## 2. 統合検証

- [ ] 2.1 出力予算とTDD結果を記録し、changesetを追加して関連テストを通す
- [ ] 2.2 `pnpm -s verify --change bound-engine-output --done` を通す <!-- loomake:gate=done -->
