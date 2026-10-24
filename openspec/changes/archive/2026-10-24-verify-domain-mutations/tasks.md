# Tasks

## 1. ドメイン判定のmutation試験

- [x] 1.1 元ファイルの保護と13条件の検出、検出とエラーの区別のテストでRedを確認し、スクリプトを実装してGreenにする（REQ-161・REQ-162・REQ-163）
- [x] 1.2 結果を保持して実行手順・対象条件・限界・TDD結果を記録し、changesetを追加する

## 2. 統合検証

- [x] 2.1 型・lintと関連テストを確認する
- [x] 2.2 `pnpm -s verify --change verify-domain-mutations --done` を通す <!-- loomake:gate=done -->
