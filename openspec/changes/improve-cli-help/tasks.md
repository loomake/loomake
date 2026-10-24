## 1. 実装
- [x] 1.1 サブコマンドのヘルプに、説明と各オプションの説明を載せる（REQ-135）
- [x] 1.2 `--change=<id>` の形を受け付け、知らないコマンドの名前を挙げて知らないと表示する（REQ-041）

## 2. テスト
- [x] 2.1 各 Scenario に対応するテストを、実装の前に書いて落ちることを確かめる。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [x] 3.1 `pnpm -s verify --change improve-cli-help --done` を通す <!-- loomake:gate=done -->
