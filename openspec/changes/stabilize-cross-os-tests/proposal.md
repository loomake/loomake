# Proposal: stabilize-cross-os-tests

## Why

macOS と Windows の CI では、run を動かす試験などがときどき時間切れする（Issue #116・#178・#181・#183）。再実行すると通るため、main への push、夜間実行、`ci:all-os` の PR の結果が試験の成否を表さなくなっている。設計メモ（`.loomake/handoff/design-step5-flaky-tests-2026-10-31.md`）で CI の記録を数えると、失敗した実行だけに、全ワーカーの記録が数十秒止まる区間があった。原因はまだ決まっていない。

試験の上限時間を延ばしたり、試験を skip したりして緑にすることはしない。この change では、時間切れが起きる 6 ファイルを期限つきで隔離し、隔離した試験を別のジョブで毎晩流して記録を集める。どの段階で止まったかが分かる記録も合わせて取る。

## What Changes

- `tests/quarantine.json` を足す。macOS・Windows で時間切れが続く試験ファイルを、OS・Issue 番号・追加日・期限（最長 14 日）とともに書く。初期の一覧は Issue #116・#178・#181・#183 の 6 ファイルで、期限は 2026-11-14 とする。
- `scripts/ci-quarantine.mjs` を足す。一覧の形式・ファイルの有無・OS・期限を検査し、quality ジョブの macOS・Windows のシャードに除外するファイルを渡す。一覧に ubuntu-latest がある場合や期限を過ぎた場合は、ジョブを失敗させる。Ubuntu のジョブは一覧を読まず、すべての試験を実行する。
- 新しいワークフロー `quality-quarantine` で、一覧のファイルを一覧の OS ごとにシャードに分けずに流す。段階の記録と心拍を有効にし、artifact を保存する。失敗しても run 全体の成否には数えない（`continue-on-error`）。一覧が空なら試験のジョブを飛ばす。手動実行では、計測のためだけに `TEMP` の向き先と並列度を選べる。
- `scripts/ci-heartbeat.mjs` を足す。macOS・Windows のシャードと隔離のジョブで、試験の前に裏で起動する。1 秒ごとに時刻と一時ディレクトリへの書き込み時間を、10 秒ごとに `node` と `git` の起動時間を記録し、artifact に保存する。
- PR #179（head 3571c20）の診断を取り込む。publication-retry の段階の記録と、監視役・偽 CLI の entry/exit を記録する preload である。PR #179 の専用ワークフロー `profile-publication-retry.yml` は作らず、隔離のジョブで同じ診断を取る。
- `tests/package-artifacts.test.ts` と `scripts/package-smoke.mjs` に、prepare・check・照合の段階の記録を足す。
- `docs/dev/ci.md` に隔離の手順を書き、`docs/dev/test-phase-profiling.md` に PR #179 の診断の読み方を移す。

試験の上限時間（`testTimeout`、`it` の第 3 引数、probe の 10 秒）、assertion、`it.each` の値、skip は変えない。製品のコード（`packages/*/src`）も変えない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `monorepo`：「試験の隔離一覧」（REQ-344）を足す。「CI のテストの分割」（REQ-214）を、2 つのシャードと隔離のジョブを合わせてすべての試験を実行する形に直す。
- `ci-test-diagnostics`：「macOS と Windows の実行環境の記録」（REQ-345）を足す。

## Impact

`.github/workflows/ci.yml`・`.github/workflows/quality-quarantine.yml`（新規）・`scripts/ci-quarantine.mjs`（新規）・`scripts/ci-heartbeat.mjs`（新規）・`scripts/package-smoke.mjs`・`vitest.config.ts`・`tests/quarantine.json`（新規）・`packages/runner/test/process-diagnostics.ts`・`packages/runner/test/publication-retry.test.ts`・`tests/package-artifacts.test.ts`・`docs/dev/ci.md`・`docs/dev/test-phase-profiling.md` と、試験 `tests/ci-quarantine.test.ts`・`tests/ci-heartbeat.test.ts`・`tests/publication-retry-diagnostics.test.ts`（いずれも新規）を変える。既存の試験で期待値を変えるのは、`tests/monorepo.test.ts` の [REQ-214] の試験の、条件の一覧だけである。

公開 API と配布するパッケージは変えないので、changeset は空にする。

この change で隔離の仕組みと記録を入れる。原因の判別（設計メモのタスク 6）、判別結果に合わせた修正（同 7）、一覧からの除外（同 8）、5 日続けての夜間実行の成功（同 9）は、main に入ってからでないと実行できない（手動実行は既定ブランチのワークフローが対象で、夜間実行は main で動く）。このため後続の change で扱う。
