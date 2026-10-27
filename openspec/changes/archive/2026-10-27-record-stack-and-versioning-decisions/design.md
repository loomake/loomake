# Design: record-stack-and-versioning-decisions

## Context

C-001（WBS 5 章）は core のスキーマ（W1-1）・契約テスト（W1-2）・判定（W1-4）・`verify --done --json`（W1-5）の最初の切り出しである。どの技術で書くかが決まらないと、C-001 の作業範囲も事前見積もり（W0-7）も決まらない。

決めることは 3 つあり、どれも利用者の判断に当たる。選択肢・利点と欠点・おすすめは trace.md の確認事項 Q-01〜Q-03 に書いた。

## 決めること

| 確認事項 | 決めること | 決まらないと進められないこと |
|---|---|---|
| Q-01 | core の契約を Zod で書くか。REQ-046 との関係 | C-001 の W1-1、事前見積もり、REQ-046 を変える change を作るかどうか |
| Q-02 | 開発の技術スタックを、リポジトリと文書のどちらにそろえるか | WBS・overview・アーキテクチャの直し方、C-001 の事前見積もり |
| Q-03 | `0.x` の間、マイナー版で破壊的変更を許すか | W0-6 の ADR と CONTRIBUTING.md の記述 |

## Decisions

- 利用者が 2026-10-26 に Q-01〜Q-03 へ回答した（3 件とも A。PR #10 のコメント 6403295324）。Q-01 は core の実行時依存に Zod を採る、Q-02 はいまの開発の技術スタックを維持する、Q-03 は `0.x` の間の破壊的変更を minor で出す。回答ごとに ADR を書く（タスク 1〜3）
- 回答に合わせて、要件台帳の状態を次のように改めた。REQ-227 は 0.x の方針として ADR と CONTRIBUTING.md に書くので反映済とする。REQ-231 は REQ-046 を変える別の change で扱うので範囲外とする。REQ-232 は採らないので範囲外とする。REQ-233 は形式の版を REQ-053 の規則で上げるので、既存仕様で充足とする
- C-001 の事前見積もりは Q-01・Q-02 の回答のあとに行う。作業範囲が技術の選択で変わるため（タスク 4.3）
- 回答によって仕様の変更が要るとき（REQ-046 を変える、スタックを移すなど）は、この change に含めず別の change を作る（タスク 5.3）

## Risks

- 別の担当がマージ済みの change の archive と ID の振り直しを並行して進めている。番号が重なったら、この change の番号を合わせて直す

## 要件 ID の振り直し（2026-10-26）

この change は最初 REQ-214〜223 を使っていた。PR #11（change `speed-up-ci`）が REQ-214・REQ-215 を、PR #13（マージ済みの change の archive）が REQ-224・REQ-225 を使っているため、開いているすべての PR のブランチと `origin/main` で使われていない REQ-226〜235 に振り直した。要約は trace.md の要件台帳のとおりで、中身は変えていない。

| 旧 ID | 新 ID | 要約 |
|---|---|---|
| REQ-214 | REQ-226 | 版管理の方式（changesets か `npm version`）を決める |
| REQ-215 | REQ-227 | `0.x` の互換性の方針を決める |
| REQ-216 | REQ-228 | 成果物は ADR。方式が決まり、CONTRIBUTING.md に書かれる |
| REQ-217 | REQ-229 | 開発効率の手書きの記録様式を決める |
| REQ-218 | REQ-230 | C-001 の着手前に事前見積もりを記録し、あとで書き換えない |
| REQ-219 | REQ-231 | core の契約を Zod スキーマで定義する（実行時の依存は core の zod と kit の yaml に限る） |
| REQ-220 | REQ-232 | パッケージ管理・テスト・lint の技術スタック（npm workspaces・`node:test`・Biome） |
| REQ-221 | REQ-233 | `0.x` の間の形式の互換性（要件定義 7.3） |
| REQ-222 | REQ-234 | 原則への例外と重要な設計変更を ADR に残す |
| REQ-223 | REQ-235 | 開発効率の集計（W1-9。範囲外） |

## 次の change：`allow-zod-and-yaml-runtime-deps`

Q-01 の回答（A）と ADR 0003 を仕様に反映するための change。この change では作らず、名前と範囲だけを決めておく（タスク 5.3）。C-001 の実装を始める前に作る。

| 項目 | 内容 |
|---|---|
| 変える仕様 | `openspec/specs/core-parsers/spec.md` の「実行時依存ゼロ」（REQ-046）を「`@loomake/core` の外部の実行時依存は `zod` だけ」に変える。`openspec/specs/verify/spec.md` の「実行時依存の範囲」（REQ-047）の kit の部分を「`@loomake/core` と `yaml` だけ」に変える。trace・runner・loomake の依存（REQ-083・REQ-123・REQ-047 の loomake の部分）は変えない |
| 変える文書 | AGENTS.md の「プロジェクト固有の情報」のコーディング規約、CONTRIBUTING.md の「コードの境界」の依存の記述 |
| 変えるテスト | `packages/core/test/package.test.ts` の `[REQ-046]`、`packages/cli/test/cli.test.ts` の kit の `[REQ-047]`。仕様の変更に合わせて期待値を変えるので、その change の確認事項で人の承認を得る |
| 含めないもの | Zod のスキーマを書き、いまの手書きの検査と `packages/core/schema/verify-result.schema.json` を移す作業（C-001 の W1-1）。依存を実際に `package.json` に足すのは、使う C-001 で行う |
| 出典 | この change の trace.md の Q-01、`docs/adr/0003-zod-as-core-runtime-dependency.md`、要件定義 v0.11.2 の NFR-01 |
