# split-ci-gate-requirement

## Why
make-ci-change-selection-explicit で書き換えた monorepo の Requirement「プルリクエストごとの完了ゲート」は 500 文字を超え、`openspec validate --specs --strict` で警告になる。また、Windows の CI で `[REQ-056]` の changeset status のテストが 5 秒の時間制限を超えて失敗することがある（PR #26 の 1 回目の CI で約 11 秒かかった）。

## What Changes
- 「プルリクエストごとの完了ゲート」を、完了ゲートの実行、対象の change の決め方、対象の change がない PR の扱いの 3 つの Requirement に分ける。振る舞いは変えない（REQ-010・REQ-132）
- `[REQ-056]` のテストの時間制限を 60 秒にする。確かめる内容は変えない

## Non-goals
- ci-gate の振る舞いを変えること
- ほかのテストの時間制限を変えること

## Impact
- 影響する capability：monorepo（Requirement の変更と追加）
- 影響するコード：`tests/monorepo.test.ts`
