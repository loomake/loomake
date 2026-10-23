## 1. 実装
- [ ] 1.1 package.json の依存に loomake がないとき、開発用の依存に足すコマンドを案内する（REQ-019）
- [ ] 1.2 package.json がないとき、commands を書き換えるよう案内する（REQ-024）
- [ ] 1.3 docs/usage.md の導入手順に、loomake を開発用の依存に足す手順を書く

## 2. テスト
- [ ] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる。ファイルは一時ディレクトリに作る

## 3. 確認
- [ ] 3.1 `pnpm -s verify --change improve-init-guidance --done` を通す
