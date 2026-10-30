# Proposal: bound-engine-timer-and-interrupt

## Why

`loomake run` のエンジンの時間の上限は `setTimeout` 1 回で監視している（`packages/runner/src/engine.ts`）。Node のタイマーの上限 2147483647ms（約 35,792 分）を超える値を渡すと、Node は 1ms に丸める。`run.timeoutMinutes` は正の有限数なら受け付けるので、約 35,792 分以上を設定すると、エンジンが約 250ms で「実行時間の上限に達しました」で止まる。外部操作の監視役は待機を上限以下に分けているが、エンジン側は分けていない。

また、git・gh の実行中に監視役が SIGINT・SIGTERM を受けて外部操作を中断で止めると、run はそれを実行中の失敗と同じに扱い、summary.json の状態を `stopped` にする。中断（REQ-124・REQ-208）では状態を `interrupted` にする決まりなので、記録が仕様とずれている。

## What Changes

- エンジンの期限の待機を、タイマーの上限以下に分ける。発火するたびに単調時計で残り時間を計り直し、尽きたときだけ時間切れにする（REQ-336）。`run.timeoutMinutes` の既定と受け付ける値は変えない。
- 共有予算で後続の外部操作を拒否するとき、監視役の異常終了の理由を引き継ぐ。利用者の中断と理由の有無で区別する（REQ-250・REQ-337）。
- 実行の記録を作ったあとの git・gh で、監視役が利用者の信号で止めた中断（理由を持たない `ProcessLimitError`）は、summary.json の状態を `interrupted` にする。証拠のあとの push・PR の検索・作成の中断も同じとする。監視役が結果を書かずに終わった中断は、利用者の中断と区別して `stopped` のままとする（REQ-337）。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `run`：エンジンの時間の上限とタイマーの上限（REQ-336）、外部操作のあいだの中断の記録（REQ-337）の要件を足す。既存の REQ-105・REQ-124・REQ-137・REQ-141・REQ-208 の文は変えない。

## Impact

`packages/runner/src/engine.ts`・`run.ts`・`run/phases.ts` と、runner のテスト（新規の `engine-long-deadline.test.ts`、`signal-during-sync.test.ts`、`helpers.ts`、`external-budget.test.ts`）を変える。`docs/guide/2.guides/3.run-recovery.md` に 1 文足す。`packages/kit/src/runtime/process.ts` と `packages/kit/test/process.test.ts` も変える。監視役の SIGHUP の扱いは別の change の範囲とする。公開 API・設定の形・依存は変えない。`@loomake/kit`・`@loomake/runner`・`loomake` の patch の changeset を足す。

archive する PR では、この change の Scenario のレビュー（`docs/quality/scenarios.json` の change 側の ID）を、`openspec/specs/run/spec.md` 側の ID に移す。

## 範囲外

- `packages/kit/supervisor/supervisor.cjs`（SIGHUP の扱い。別の change `stop-command-group-on-sighup` の範囲）。
- `packages/runner/src/config.ts` の `timeoutMinutes` の上限。おすすめの案では変えない（Q-01）。
- 準備中（記録を作る前）の中断。REQ-182 のとおり終了コード 3 のまま。
- コミット中に中断したとき、tasks.md の完了印が作業ツリーに残る既存の挙動（`phases.ts` の印は commit より前に付く）。

## Issue に回す

設計で見つかったが、この change では扱わないもの。[Issue #161](https://github.com/loomake/loomake/issues/161) で追跡する。

- `timeoutMinutes × 60000` が Infinity になる値（約 1.8e303 分超）を設定したときの文言。いまも `UsageError`（終了コード 2）で止まり、丸めの不具合とは別である（Q-06）。
