# Trace: allow-zod-and-yaml-runtime-deps

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
この change は、change record-stack-and-versioning-decisions の Q-01 の回答 A と ADR 0003 を、REQ-046 と REQ-047 に反映する。範囲はその change の design.md の「次の change：allow-zod-and-yaml-runtime-deps」の表のとおり。
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/adr/0003-zod-as-core-runtime-dependency.md | 採用 | 2026-10-26 |
| openspec/changes/record-stack-and-versioning-decisions/trace.md の Q-01 と回答（PR #10 のコメント 6403295324） | - | 2026-10-26 |
| docs/requirements/loomake-v0.11.md | v0.11.2 | 2026-10-26 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-046 | docs/requirements/loomake-v0.11.md v0.11.2 §6.2 NFR-01 の 1 文目、ADR 0003 の「決定」と「適用範囲」、record-stack-and-versioning-decisions の trace.md の Q-01 の回答 | 非機能 | `@loomake/core` の外部の実行時依存は `zod` だけとする（もとは要件定義書 v0.1 N-01 の「core は実行時の外部依存をゼロにする」） | 反映済 | specs/core-parsers/spec.md |
| REQ-047 | docs/requirements/loomake-v0.11.md v0.11.2 §6.2 NFR-01 の 1 文目、ADR 0003 の「適用範囲」の 2 つ目、record-stack-and-versioning-decisions の trace.md の Q-01 の回答 | 非機能 | `@loomake/kit` の実行時依存は `@loomake/core` と `yaml` だけとする。`loomake` の実行時依存（`@loomake/core`・`@loomake/kit`・`@loomake/trace`・`@loomake/runner` のみ）は変えない | 反映済 | specs/verify/spec.md |
| REQ-260 | docs/requirements/loomake-v0.11.md v0.11.2 §6.2 NFR-01 の 2 文目 | 非機能 | 実行時の依存を増やすときは、標準機能で足りないこと、自作よりコードと保守が減ること、実行経路に必要なことを文書に書く | 確認待ち | Q-04 |

## 確認事項

<!-- 回答 欄が空で ブロッキング = yes の行があると、verify の仕様ゲートは失敗する。回答を書いたら、回答者（名前の代わりに役割でもよい）と回答日（YYYY-MM-DD）も書く -->

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-046, REQ-047 | 2 つのテストの期待値を、仕様の変更に合わせて変えてよいですか。1 つは `packages/core/test/package.test.ts` の `[REQ-046] dependencies を持たない` で、いまは `dependencies` が空であることを確かめています。もう 1 つは `packages/cli/test/cli.test.ts` の `[REQ-047] kit の dependencies は @loomake/core だけ` で、いまは `dependencies` が `['@loomake/core']` と完全に一致することを確かめています。AGENTS.md 4 章は、テストの期待値を書き換えるときに人の承認を求めています。新しい期待値は Q-02 の回答で決まります。決まらないと、tasks.md の 3.1・3.2 に進めません | A：承認する。2 つのテストの名前と期待値を、差分仕様の Scenario（Q-02 の回答に合わせたもの）に合わせて変える。B：承認しない。テストを変えずに、この change を止める。仕様だけを変えるとテストと食い違い、完了ゲートを通せない | A。理由：利用者が change record-stack-and-versioning-decisions の Q-01 で決めた方針と ADR 0003 を、仕様に反映するための変更です。テストを弱めることが目的ではありません。loomake の `[REQ-047]` のテストと、trace・runner の依存のテスト（REQ-083・REQ-123）は変えません | yes | | | |
| Q-02 | REQ-046, REQ-047 | 仕様の「だけ」を、テストで依存の上限として確かめますか。それとも、その依存がちょうどあることとして確かめますか。この change では `package.json` に `zod` と `yaml` を足しません（足すのは C-001 の W1-1）。そのため、いまの core の `dependencies` は空で、kit の `dependencies` は `@loomake/core` だけです。差分仕様の Scenario は、おすすめの A で書いてあります。決まらないと、Scenario の文とテストの期待値が決まりません | A：上限として確かめる。core は「`zod` 以外を含まない」、kit は「`@loomake/core` を含み、`@loomake/core` と `yaml` 以外を含まない」。利点は、いまも C-001 で依存を足したあとも、テストを変えずに通ること。loomake の `[REQ-047]` のテストと同じ確かめ方になること。欠点は、依存を足し忘れてもこのテストでは気づけないこと（使うコードの import が失敗するので、ほかのテストで気づける）。B：ちょうどその依存があることを確かめる。core は `['zod']`、kit は `['@loomake/core', 'yaml']`。利点は、仕様と `package.json` の対応が一目で分かること。欠点は、いまの `package.json` では通らないので、この change で依存を足す必要があること。範囲（依存は C-001 で足す）が変わり、まだ使わない依存が配布物に入る。C：この change では A で確かめ、C-001 で依存を足すときに B に変える。利点は、依存を足したあとの状態を厳密に確かめられること。欠点は、C-001 で仕様とテストの期待値をもう一度変える必要があり、そのときも承認が要ること | A。理由：仕様の文（「`zod` だけとする」「`zod` 以外のパッケージを含まない」）は依存の上限を定めていて、A はそれをそのまま確かめます。この change の範囲（依存を足さない）のまま通せて、C-001 で仕様とテストをもう一度変えずに済みます | yes | | | |
| Q-03 | REQ-046 | core-parsers の Requirement「実行時依存ゼロ」を消し、同じ要件 ID（REQ-046）で「core の実行時依存の範囲」を足す形にしてよいですか。zod を許すと、いまの名前と Scenario「dependencies が空」は中身と合わなくなります。OpenSpec の MODIFIED では、Requirement の中身を変えても、いまある Scenario は消せません（`openspec validate --strict` が失敗します）。差分仕様は、おすすめの A で書いてあります | A：消して足す（REMOVED と ADDED）。利点は、Requirement と Scenario の名前が中身と合うこと。verify の「実行時依存の範囲」（REQ-047）と言い方がそろうこと。欠点は、古い名前で探す人が見つけにくくなること（要件 ID の REQ-046 は変わらない）。B：MODIFIED で Requirement と Scenario の名前を残し、本文と WHEN・THEN だけを変える（change align-ci-node-floor-wording と同じやり方）。利点は、Requirement が仕様の同じ位置に残ること。欠点は、「ゼロ」「空」という名前の下に、zod を許す文が入ること | A。理由：名前と中身が食い違うと、仕様を読む人とエージェントが読み誤るおそれがあります。要件 ID は変わらないので、テストの `[REQ-046]` との対応は保たれます | no | | | |
| Q-04 | REQ-260 | 要件定義 v0.11.2 の NFR-01 の 2 文目「増やすときは、標準機能で足りないこと、自作よりコードと保守が減ること、実行経路に必要なことを文書に書く」を、この change で扱いますか。この change の範囲（change record-stack-and-versioning-decisions の design.md の表）は、NFR-01 の 1 文目だけを扱っています。決まらないと、REQ-260 の状態が確認待ちのまま残り、完了ゲートを通せません | A：扱わない。範囲外として proposal.md の Non-goals に書き、扱う change をあとで決める。利点は、この change を design.md の表のとおりに保てること。zod を足す理由は、すでに ADR 0003 に書いてあること。欠点は、依存を増やすときの決まりが仕様にも文書にも残らないこと。B：文書だけで扱う。CONTRIBUTING.md の「コードの境界」に、依存を増やすときに書く 3 点を足す（tasks.md 2.2 に含める）。REQ-260 は仕様にしないので、状態は範囲外とし、反映先に CONTRIBUTING.md を書く。利点は、仕様を増やさずに、依存を足す人が決まりを読めること。欠点は、テストで確かめないこと。C：Requirement として仕様に足す（ADDED）。利点は、仕様として残ること。欠点は、「文書に書く」をテストで確かめる方法がなく、Scenario を書きにくいこと | B。理由：依存を足す人が読むのは CONTRIBUTING.md で、「文書に書く」という要求の形にも合います。tasks.md 2.2 で同じ節を直すので、手間も小さく済みます | no | | | |

## 仮定

<!-- 承認 欄が空の仮定は verify で警告になる（失敗にはしない）。承認したら、承認者（名前の代わりに役割でもよい）と承認日（YYYY-MM-DD）も書く -->

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
