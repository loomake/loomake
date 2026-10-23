# add-agreement-columns

## Why
trace の検収レポートは、確認事項ごとに回答者・回答日を、仮定ごとに承認者・承認日を一覧にする（trace 要件定義書 v0.1 §3.3）。いまの trace.md の表にはその列がない。trace の確認事項 Q-01 の回答で、表に列を足すことに決まった。add-trace-report の前に、この change で trace.md の書式と core の読み取りを変える。

## What Changes
- trace.md の確認事項の表に「回答者」「回答日」、仮定の表に「承認者」「承認日」の列を足す（REQ-077、REQ-078）
- core の `parseTrace` が新しい列を読み、列のない既存の trace.md も読めるようにする（REQ-011）
- core の `createTraceTemplate` と、kit が配る trace.md の雛形に新しい列を入れる（REQ-017）

## Non-goals
- verify が、回答者・回答日の空の欄を警告すること（trace report が警告する）
- 既存の trace.md に列を足して書き直すこと

## Impact
- 影響する capability：core-parsers（Requirement の変更）
- 影響するコード：`packages/core/src/trace.ts`・`template.ts`、`packages/kit/templates/skills/req-to-openspec/templates/trace.md`、`.agents/skills/req-to-openspec/templates/trace.md`
