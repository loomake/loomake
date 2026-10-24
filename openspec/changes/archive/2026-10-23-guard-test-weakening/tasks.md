## 1. 実装
- [x] 1.1 HEAD にあったテストファイルから、アサーションかテストの宣言の行を消すか書き換えたら止まる（REQ-109）

## 2. テスト
- [x] 2.1 各 Scenario に対応するテストを、実装の前に書いて落ちることを確かめる。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [x] 3.1 `pnpm -s verify --change guard-test-weakening --done` を通す <!-- loomake:gate=done -->
