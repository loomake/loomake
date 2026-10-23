## 1. 実装
- [x] 1.1 エンジンへの指示の決まりに、コミットとブランチの切り替えをしないことを足す（REQ-098）

## 2. テスト
- [x] 2.1 Scenario に対応するテストを書く。テスト名に [REQ-098] を入れる

## 3. 確認
- [x] 3.1 `pnpm -s verify --change tell-engine-not-to-commit --done` を通す <!-- loomake:gate=done -->
