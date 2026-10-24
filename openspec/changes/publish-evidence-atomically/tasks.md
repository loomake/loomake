# Tasks

## 1. 証拠の検証と公開

- [x] 1.1 完成JSONの形式・サイズ・UTF-8境界のテストでRedを確認し、保存前の検証を実装してGreenにする（REQ-174）
- [x] 1.2 原子的な公開と失敗時の片付け、runの保存失敗と再試行のテストでRedを確認し、実装してGreenにする（REQ-175・REQ-176）

## 2. 統合検証

- [ ] 2.1 復旧手順と保証範囲・TDD・changesetを記録し、関連テスト・型・lintを通す
- [ ] 2.2 `pnpm -s verify --change publish-evidence-atomically --done` を通す <!-- loomake:gate=done -->
