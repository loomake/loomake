# Tasks

## 1. verify とエラーの型

- [x] 1.1 `--skip-commands` の項目と表示のテストで Red を確かめ、verify に「品質コマンド」の skip の項目を足して Green にする（REQ-191）
- [x] 1.2 外部操作の上限で止まったときの終了コードのテストで Red を確かめ、`RuntimeFailure` を足して CLI で終了コード 3 にする（REQ-192）
- [x] 1.3 壊れた設定ファイルでの run のテストで Red を確かめ、run の設定の読み込みを UsageError にする（REQ-193）

## 2. CLI の引数

- [x] 2.1 `--name=value` のテストで Red を確かめ、値をとるオプションで等号の形を受け付ける（REQ-194）
- [x] 2.2 打ち間違いのテストで Red を確かめ、サブコマンドとオプションに近い候補を示す（REQ-195）

## 3. 統合検証

- [ ] 3.1 docs（usage・for-agents）と changeset を更新し、TDD の結果を tdd.md に記録する
- [ ] 3.2 `pnpm -s verify --change close-cli-gaps --done` を通す <!-- loomake:gate=done -->
