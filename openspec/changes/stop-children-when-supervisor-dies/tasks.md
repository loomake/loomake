# Tasks

## 1. 監視役が結果を書かずに終わったとき

- [ ] 1.1 監視役を SIGKILL で止める試験を足し、いまの実装で落ちること（Red）を確かめる（REQ-181・REQ-250）
- [ ] 1.2 監視役が対象の PID を先に書き、親が結果を読めないときに子孫を止めて理由を含む中断として返すようにする。changeset を足す（REQ-181・REQ-250）

## 2. 品質コマンドの中断の試験

- [ ] 2.1 lint の `exec` をやめ、祖先をたどって見つけた監視役に SIGINT を送る。送った先が監視役であることを確かめる（REQ-183・REQ-250）

## 3. 統合検証

- [ ] 3.1 Windows の CI で、対象の 3 件が通ることを main の失敗とテストごとに照合し、tdd.md に記録する
- [ ] 3.2 `pnpm -s verify --change stop-children-when-supervisor-dies --done` を通す <!-- loomake:gate=done -->
