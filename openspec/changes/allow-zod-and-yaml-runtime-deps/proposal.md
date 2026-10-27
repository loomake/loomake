# allow-zod-and-yaml-runtime-deps

## Why
利用者は 2026-10-26 に、`@loomake/core` の契約を Zod で書くと決めた。core の外部の実行時依存は `zod` だけとし、`yaml` は kit に置く（change `record-stack-and-versioning-decisions` の trace.md の Q-01 の回答 A、`docs/adr/0003-zod-as-core-runtime-dependency.md`）。要件定義 v0.11.2 の NFR-01 も、実行時の依存を `@loomake/core` の `zod` と `@loomake/kit` の `yaml` に限るとしている。ところが、いまの仕様は core の実行時依存をゼロ（REQ-046）、kit の実行時依存を core だけ（REQ-047）と定めている。このままでは C-001（WBS の W1-1）で zod と yaml を使えないので、この change で 2 つの Requirement を決定に合わせる。

## What Changes
- core-parsers の「実行時依存ゼロ」（REQ-046）を消し（REMOVED）、`@loomake/core` の外部の実行時依存を `zod` だけとする「core の実行時依存の範囲」（REQ-046）を足す（ADDED）。OpenSpec の MODIFIED では Scenario「dependencies が空」を消せないので、この形にした。この形にすることは、確認事項 Q-03 の回答 A で決まった
- verify の「実行時依存の範囲」（REQ-047）のうち kit の部分を、`@loomake/core` と `yaml` だけにする（MODIFIED）。loomake の部分は変えない
- monorepo の「kit の中の依存の向き」（REQ-207）で、kit の外部のパッケージとして import してよいものに `yaml` を加える（MODIFIED）。runtime/ から機能、機能どうし、`@loomake/kit` やほかのパッケージを経由する依存を認めない決まりは変えない。REQ-047 で kit に `yaml` を認めても、REQ-207 と `tests/kit-layers.test.ts` が `yaml` の import を拒むと、C-001 で `yaml` を使えないため（PR #26 のレビューの指摘）。`tests/kit-layers.test.ts` を変える前に、確認事項 Q-05 で人の承認を得る（tasks.md 5）
- AGENTS.md の「プロジェクト固有の情報」のコーディング規約と、CONTRIBUTING.md の「コードの境界」の依存の記述を、仕様に合わせる（tasks.md 2）
- `packages/core/test/package.test.ts` の `[REQ-046]` と、`packages/cli/test/cli.test.ts` の kit の `[REQ-047]` の期待値を、仕様に合わせて変える。AGENTS.md 4 章により、変える前に確認事項 Q-01 で人の承認を得る（tasks.md 3）

## Non-goals
- Zod のスキーマを書くこと、いまの手書きの検査と `packages/core/schema/verify-result.schema.json` を Zod に移すこと（C-001 の W1-1）
- `zod` と `yaml` を `package.json` の `dependencies` に足すこと。使う C-001 で足す。C-001 への申し送り：足すときは、必要な依存が配布パッケージの `dependencies` に宣言されていることも、配布物の検証で確かめる（確認事項 Q-02 の回答）
- 依存を増やすときに書く 3 点（REQ-260）を仕様にすること。製品の実行時仕様の範囲外なので、開発上の手順として CONTRIBUTING.md に書く（確認事項 Q-04 の回答 B、tasks.md 2.4）
- trace・runner・loomake の依存の範囲（REQ-083・REQ-123・REQ-047 の loomake の部分）を変えること
- core-parsers と verify の Purpose を直すこと（archive では反映されない）

## Impact
- 影響する capability：core-parsers（REQ-046）、verify（REQ-047 の kit の部分）、monorepo（REQ-207）
- 影響する文書：AGENTS.md、CONTRIBUTING.md、`docs/adr/0003-zod-as-core-runtime-dependency.md`、`docs/adr/README.md` の一覧の状態
- 影響する品質記録：`docs/quality/scenarios.json` の REQ-046・REQ-047 のレビュー 3 件（tasks.md 4）
- 影響するテスト：`packages/core/test/package.test.ts`、`packages/cli/test/cli.test.ts`、`tests/kit-layers.test.ts`（Q-05 の承認のあと）
- 影響するコード：なし（この change では依存を足さない）
- 利用者に見える変更：なし
- この change のブランチは PR #10（`record-stack-and-versioning-decisions`）のブランチから作った。PR #10 は main に入り、そのあとの main（PR #27 の archive まで）を取り込んだので、main との差分はこの change の分だけである
- archive する PR への申し送り（tasks.md 4.2）：
  - core-parsers の「実行時依存ゼロ / dependencies が空」のレビュー（SCN-f9797c510a56149bfd76）を消し、「zod 以外の依存がない」のレビュー（SCN-7a09237b3616f253ec95）の ID を archive 後の ID（SCN-2b9b1052b81cdd63ebbf）に付け替える（前例：コミット cc5df0f）
  - verify の「kit の依存」と「loomake の依存」は、archive 後も ID が変わらない（SCN-129c1a409ad4cdd46ce6・SCN-38961b7ee7aa96aad6f6）。今の仕様に対するレビューを消し、change 側のレビュー（SCN-96cb0a31550cb8b25bcd・SCN-23a323ae6d48ddc37ec7）の ID を archive 後の ID に付け替えて残す
  - `packages/core/test/package.test.ts` を変えたので、同じファイルを参照する core-parsers の「OpenSpec 書式との互換 / 追加書式を含む change の検証」のレビュー（SCN-59cd71015c5e0c1dd2e1）も、試験のソースのハッシュが合わなくなって無効になった。この change では、ハッシュだけを書き換えることはしない。テストを読み直してレビューし直すかは、品質記録を見直すときに決める
