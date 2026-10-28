# Tasks

## 1. 仕様

- [x] 1.1 proposal・trace（振り分けの表）と差分仕様（4 個の REMOVED）を書き、仕様ゲートを通す

## 2. 移す

- [ ] 2.1 外す 4 個の内容を `docs/dev/`（README.md・devcontainer.md・ci.md・testing-across-os.md）に移し、分け方の基準を ADR 0005 に残す
- [ ] 2.2 REQ-004・REQ-061・REQ-215・REQ-236・REQ-240 を名前に入れていた試験から、その要件 ID だけを外す。期待値と処理は変えない。コメントの参照先を `docs/dev/` に直す
- [ ] 2.3 AGENTS.md の 1 章に、「仕様に書かれていない振る舞いは実装しない」が `docs/dev/` の開発の仕組みには当てはまらないことを 1 文足す

## 3. 確認

- [ ] 3.1 `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` を通す
- [ ] 3.2 `pnpm -s verify --change move-dev-mechanics-to-docs --done` を通す <!-- loomake:gate=done -->
