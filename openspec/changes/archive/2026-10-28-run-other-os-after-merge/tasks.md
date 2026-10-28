# Tasks

## 1. 仕様

- [x] 1.1 proposal・trace と差分仕様（REQ-049 を MODIFIED、REQ-273）を書き、仕様ゲートを通す

## 2. 実装

- [x] 2.1 `tests/monorepo.test.ts` に、quality ジョブの OS のマトリクスの式を評価する試験を書く。ラベルのない PR、main への push と定期実行、`ci:all-os` ラベルのある PR の 3 つの条件で、どの OS の quality ジョブができるかをそれぞれ確かめる。`on:` に labeled と schedule があること、node20・node22・gate が OS の切り替えの影響を受けないことも確かめる（REQ-049, REQ-273）
- [x] 2.2 既存の `[REQ-214]`・`[REQ-270]`（`tests/monorepo.test.ts`）と `[REQ-144]`（`tests/package-workflows.test.ts`）のうち、マトリクスの OS の行と `on:` の行を読む部分を、新しい ci.yml に合わせる。シャード・カバレッジ・文書だけの PR の検査は弱めない（REQ-049, REQ-214, REQ-270）
- [x] 2.3 `.github/workflows/ci.yml` の quality ジョブの OS を式で切り替え、`on:` に labeled と schedule を足す。README.md の CI の説明を直す。空の changeset を足す（REQ-049, REQ-273）

## 3. 確認

- [x] 3.1 `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` を通す
- [x] 3.2 `pnpm -s verify --change run-other-os-after-merge --done` を通す <!-- loomake:gate=done -->
