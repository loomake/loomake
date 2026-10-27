# allow-zod-and-yaml-runtime-deps

## Why
利用者は 2026-10-26 に、`@loomake/core` の契約を Zod で書くと決めた。core の外部の実行時依存は `zod` だけとし、`yaml` は kit に置く（change `record-stack-and-versioning-decisions` の trace.md の Q-01 の回答 A、`docs/adr/0003-zod-as-core-runtime-dependency.md`）。要件定義 v0.11.2 の NFR-01 も、実行時の依存を `@loomake/core` の `zod` と `@loomake/kit` の `yaml` に限るとしている。ところが、いまの仕様は core の実行時依存をゼロ（REQ-046）、kit の実行時依存を core だけ（REQ-047）と定めている。このままでは C-001（WBS の W1-1）で zod と yaml を使えないので、この change で 2 つの Requirement を決定に合わせる。

## What Changes
- core-parsers の「実行時依存ゼロ」（REQ-046）を消し（REMOVED）、`@loomake/core` の外部の実行時依存を `zod` だけとする「core の実行時依存の範囲」（REQ-046）を足す（ADDED）。OpenSpec の MODIFIED では Scenario「dependencies が空」を消せないので、この形にした。この形でよいかは確認事項 Q-03 で確かめる
- verify の「実行時依存の範囲」（REQ-047）のうち kit の部分を、`@loomake/core` と `yaml` だけにする（MODIFIED）。loomake の部分は変えない
- AGENTS.md の「プロジェクト固有の情報」のコーディング規約と、CONTRIBUTING.md の「コードの境界」の依存の記述を、仕様に合わせる（tasks.md 2）
- `packages/core/test/package.test.ts` の `[REQ-046]` と、`packages/cli/test/cli.test.ts` の kit の `[REQ-047]` の期待値を、仕様に合わせて変える。AGENTS.md 4 章により、変える前に確認事項 Q-01 で人の承認を得る（tasks.md 3）

## Non-goals
- Zod のスキーマを書くこと、いまの手書きの検査と `packages/core/schema/verify-result.schema.json` を Zod に移すこと（C-001 の W1-1）
- `zod` と `yaml` を `package.json` の `dependencies` に足すこと。使う C-001 で足す
- trace・runner・loomake の依存の範囲（REQ-083・REQ-123・REQ-047 の loomake の部分）を変えること
- core-parsers と verify の Purpose を直すこと（archive では反映されない）

## Impact
- 影響する capability：core-parsers（REQ-046）、verify（REQ-047 の kit の部分）
- 影響する文書：AGENTS.md、CONTRIBUTING.md
- 影響するテスト：`packages/core/test/package.test.ts`、`packages/cli/test/cli.test.ts`
- 影響するコード：なし（この change では依存を足さない）
- 利用者に見える変更：なし
- この change のブランチは PR #10（`record-stack-and-versioning-decisions`）のブランチから作った。PR #10 が main に入ると、main との差分はこの change の分だけになる
