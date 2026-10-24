## 1. 実装
- [x] 1.1 loomake.config.json の知らないキーを、verify では警告、doctor では注意として表示する（REQ-039・REQ-134）

## 2. テスト
- [ ] 2.1 各 Scenario に対応するテストを、実装の前に書いて落ちることを確かめる。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [ ] 3.1 `pnpm -s verify --change warn-unknown-config-keys --done` を通す <!-- loomake:gate=done -->
