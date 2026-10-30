# Proposal: gate-base-remote-ref

## Why

CI の完了ゲート（`scripts/ci-gate.mjs`）は、PR で変えたファイルを `git diff --name-only origin/${base}...HEAD` で調べている。`origin/main` とだけ書くと、git は同じ名前のタグやブランチ（`refs/tags/origin/main`・`refs/heads/origin/main`）を、リモートの追跡ブランチ（`refs/remotes/origin/main`）より先に選ぶ。そうした参照が PR のコミットの途中を指していると、gate は変えたファイルを取り違え、対象の change を選び損ねる（[Issue #42](https://github.com/loomake/loomake/issues/42) の 3）。

PR #31（change shorten-ci-wall-clock のタスク 4.8）では、`scripts/ci-docs-only.mjs` のベースを `refs/remotes/origin/<base>` に直した。gate は PR #31 の範囲外だったので、`origin/${base}` のまま残っている。

## What Changes

- `scripts/ci-gate.mjs` で PR の差分を取るときのベースを `refs/remotes/origin/${base}` と書く。
- 試験を足す。一時的な git リポジトリで、ベースと同じ名前のタグやブランチに PR のコミットの途中を指させる。それでも gate がリモートの追跡ブランチとの差分で change を選ぶことを確かめる。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `monorepo`: 完了ゲートが PR で変えたファイルを調べるときのベースの要件（REQ-272）を足す。change の選び方の順番（REQ-132）は変えない。

## Impact

`scripts/ci-gate.mjs` と `tests/ci-gate-process.test.ts` を変える。`docs/quality/scenarios.json` のうち、`tests/ci-gate-process.test.ts` を根拠にするレビューは、試験を読み直してハッシュを更新する。製品のコード、公開 API、設定、依存は変えない。配布するパッケージを変えないので、changeset は空にする。

Issue #42 の 1・2・4 はこの change の範囲外とする。

archive する PR では、この change の Scenario のレビュー（`docs/quality/scenarios.json` の change 側の ID）を、`openspec/specs/monorepo/spec.md` 側の ID に移す。
