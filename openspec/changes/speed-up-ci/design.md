# Design

## Context

quality ジョブは 3 つの OS で、lint・typecheck・`pnpm test`・build・配布物の検査を順に実行する。時間のほとんどは `pnpm test` が占め、その多くは runner のテストが実時間で期限を待つ時間である。ubuntu ではカバレッジを測るため、すべてのテストをもう 1 回実行している。

## Decisions

- ubuntu では `pnpm test --coverage` を 1 回だけ実行する。pnpm は追加の引数をスクリプトに渡すので、実行されるのは `vitest run --coverage` で、`pnpm test:coverage` と同じ閾値で失敗する。`test:coverage` のスクリプトは README.en.md が案内しているので残す
- macOS と Windows では、マトリクスの `shard`（`1/2`・`2/2`）で 2 つのジョブに分け、それぞれ `pnpm test --shard=<shard>` を実行する。2 つのシャードを合わせると、すべてのテストを 1 回ずつ実行する。シャードの数を 2 にしたのは、1 つのシャードが約 4〜5 分になり、ubuntu のジョブとほぼ同じ時間で終わるからである（仮定 A-01）
- マトリクスは、`os: [ubuntu-latest, macos-latest, windows-latest]` と `shard: ['1/2', '2/2']` の組み合わせから ubuntu を除き、`include` で ubuntu を 1 つだけ足す。ジョブ名は `quality (macos-latest, 1/2)`・`quality (ubuntu-latest)` のようになる。`fail-fast: false` は変えない
- lint・typecheck・build・配布物の検査は、どのジョブでも実行する。どれも 10 秒ほどで終わるので、分けても速くならない
- ワークフローの `concurrency` の group は `ci-<PR の番号。なければ ref>` にし、`cancel-in-progress` は `pull_request` のときだけ true にする。main への push の実行は取り消さない

## verify のテストのレポートへの影響

`loomake.config.json` の `tests.report`（`.loomake/test-report.json`）を読むのは `loomake verify` だけである。CI では、gate ジョブの `scripts/ci-gate.mjs` が `verify --change <id> --done` を実行するときに使う。このとき verify は、レポートを消してから `commands.test`（`pnpm test`）を自分で実行し、レポートを作り直す（`packages/kit/src/verify/run.ts`）。quality ジョブのレポートは使わないので、シャードに分けても verify の判定は変わらない。

## Risks and limits

- シャードの分け方は、vitest がテストファイルの単位で決める。遅いテストファイルが同じシャードに集まると、片方のシャードだけが長くなる
- ジョブの数が 3 から 5 に増え、インストールなどの共通の手順を実行する回数も増える
