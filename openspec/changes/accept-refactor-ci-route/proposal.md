# accept-refactor-ci-route

## Why

利用者は 2026-11-20 に、関数を基本 5 行以内に整える振る舞い不変のリファクタを指示した。見込みは 15〜17 本の PR になる。ところが、REQ-343 と CI の gate は `packages/*/src` を変える L3 の PR に change を求めるので、1 本目の PR #469 は gate だけで失敗している。

出典：利用者の 2026-11-20 の指示と承認。利用者は選択肢の中から「リファクタ用の経路を足す」を選び、条件を 3 つ付けた（`openspec/` を変えない、既存のテストファイルを変更・削除しない、独立レビュー 1 回）。

## What Changes

- REQ-477「リファクタの経路」を足す。L3 で `loomake-change: none` と `loomake-route: refactor` を書いた PR について、gate が承認された 3 条件と、経路の宣言が矛盾していないことを確かめる。満たせば change なしで品質コマンドを実行する。
- 条件が足りなければ、不足する条件をすべて日本語で示して失敗する。経路を名乗らない PR と spec-fix の PR の判定は変えない。
- REQ-343 の L3 の一文に、例外としてリファクタを加える。
- `docs/dev/ci.md`・`AGENTS.md`・PR テンプレートに経路の書き方を記す。`AGENTS.md` の「プロジェクト固有の情報」に、関数の書き方の規則（本体は基本 5 行以内・t-wada 流の TDD・Tidy First）を足す。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `monorepo`：REQ-477 を足し、REQ-343 の L3 の例外にリファクタを加える。

## Non-goals

- 振る舞いが変わっていないことの機械的な判定。テストを足すか、今の振る舞いをテストで固定したかどうかは、独立レビューで確かめる。
- lint・型・テスト・changeset の要否・3 OS など、既存の必須検査の省略。リファクタの経路が省くのは change と `verify --done` だけ。
- L1・L2 の判定の変更。L2 はもともと change なしで進められる。
- `packages/kit/templates/` の配布用テンプレートの変更。
- 承認された 3 条件以外の条件の追加や緩和。

## Impact

- `scripts/ci-gate.mjs` と、条件を調べる新しいモジュール `scripts/ci-refactor.mjs`。
- REQ-343・REQ-477 の差分仕様、CI の試験、`docs/dev/ci.md`、`AGENTS.md`、`.github/PULL_REQUEST_TEMPLATE.md`。
- この PR は `openspec/` を変える通常の L3 として進め、今回足す経路は使わない。
