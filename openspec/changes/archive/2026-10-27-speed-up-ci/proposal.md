# speed-up-ci

## Why
PR の CI が終わるまでに 10 分ほどかかる。2026-10-26 05:18（日本時間）の PR の実行では、quality ジョブに Windows で約 10 分（うち `pnpm test` が 9 分あまり）、macOS で約 9 分（うち `pnpm test` が 8 分）、ubuntu で約 6.5 分かかった。ubuntu では `pnpm test`（3 分）と `pnpm test:coverage`（3 分）で、すべてのテストを 2 回実行している。gate ジョブ（約 3.5 分）はほかのジョブと並行して動くので、全体の時間を決めているのは quality ジョブである。また、同じ PR に push を重ねても、古い実行は最後まで動き続ける。

## What Changes
- ubuntu の quality ジョブでは、`pnpm test --coverage` で、すべてのテストを 1 回だけ、カバレッジ付きで実行する。カバレッジの閾値（vitest.config.ts）は変えない（REQ-214）
- macOS と Windows の quality ジョブでは、テストを 2 つのシャード（`pnpm test --shard=1/2`・`--shard=2/2`）に分け、別々のジョブで並行して実行する。lint・typecheck・build・配布物の検査は、どのジョブでも実行する（REQ-214）
- ワークフローに `concurrency` を指定し、同じ PR に新しい push があれば古い実行を取り消す。main への push の実行は取り消さない（REQ-215）

## Non-goals
- テストそのものを速くすること（runner のテストの時間の上限や待ち時間を変えること）
- gate ジョブ・node20 ジョブ・node22 ジョブを変えること
- Windows の quality ジョブで以前から起きている `pnpm test` の失敗を直すこと

## Impact
- 影響する capability：monorepo（Requirement を 2 つ追加する。REQ-049「3 つの OS での CI」の本文は変えない）
- 影響するファイル：`.github/workflows/ci.yml`、`tests/monorepo.test.ts`
- 利用者に見える変更：なし（配布するパッケージは変えない）
