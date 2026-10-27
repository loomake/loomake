# 0003 core の実行時依存に Zod を採る

- 状態：採用（仕様への反映は別の change で行う。それまでは仕様 REQ-046 の「core は実行時の外部依存をゼロにする」と REQ-047 の「kit の実行時依存は core のみ」が有効）
- 決めた日：2026-10-26
- 決めた人：利用者（PR #10 のコメント 6403295324 での回答。利用者の「Q-01〜03の回答して」という依頼に基づく方針選択）
- 出典：WBS の W1-1、要件定義 v0.11.1 の NFR-01・NFR-02、change `record-stack-and-versioning-decisions` の trace.md の Q-01（REQ-231）

## 決定

`@loomake/core` の契約（trace.md・spec・tasks・quality.yaml・verify JSON のスキーマ）は Zod で書き、スキーマから型と JSON Schema を導出する。core の外部の実行時依存は `zod` だけとし、`yaml` は kit 側に置く。

いまの仕様 REQ-046（`openspec/specs/core-parsers/spec.md` の「実行時依存ゼロ」）は、別の change `allow-zod-and-yaml-runtime-deps` で変える。kit に `yaml` を置くには REQ-047（`openspec/specs/verify/spec.md` の「実行時依存の範囲」）も変える必要があるので、同じ change で扱う。その change で、AGENTS.md と CONTRIBUTING.md の依存の記述もそろえる。

## 検討した選択肢

- **A：Zod を採る**：REQ-046 を別の change で「core の実行時依存は zod だけ」に変える。利点は、要件定義・アーキテクチャ・WBS のとおりに進められること、スキーマ・型・検証を 1 か所にまとめられること、JSON Schema を Zod から書き出せること。欠点は、core を使う人に zod が入ること、zod の major の更新に追従が要ること、いまの手書きの検査と `packages/core/schema/verify-result.schema.json` を移す手間がかかること
- **B：依存ゼロを守る**：スキーマは JSON Schema で書き、検査は手で書く。利点は、REQ-046 と AGENTS.md を変えずに済み、いまの実装の延長で進められること。欠点は、型と JSON Schema と検査の 3 つを別々に保つことになり、NFR-02 の「重複定義しない」を満たせないこと、要件定義・アーキテクチャ・WBS を B に合わせて直す必要があること
- **C：Zod を開発時だけ使う**：JSON Schema と型をビルド時に生成し、配布物に zod を含めない。利点は、REQ-046 を守ったまま、定義を Zod の 1 か所にできること。欠点は、実行時の検査を別に持つ必要があり、手書きにすると定義が 2 つになり、検査器を足すと依存ゼロでなくなること。公開する型宣言が zod の型を参照しないように注意が要ること。生成の仕組みを保守する手間が増えること

## 理由

- 2026-10-25 に正本として取り込んだ要件定義 v0.11.1（NFR-01・NFR-02・7.3）、アーキテクチャ v2.5.3（0.1・6 章・付録 A）、WBS v1.3.1（W0-3・W1-1）が、そろって Zod を前提にしている。REQ-046 は、その前の要件定義書 v0.1 の N-01 から来ている
- アーキテクチャ 0.1 は「依存ゼロを目的に解析器や実行基盤を自作すると、かえってコードが増える」とし、保守負担が小さい方を選ぶ方針である
- 定義の重複と手書きの検査の保守を減らせる。W1-1 の完了条件「スキーマから型を導出し、JSON Schema の書き出しが CI で差分を出さない」を最も直接に満たすのも A である

## 適用範囲

- 対象は `@loomake/core` の実行時依存と、core が公開する契約のスキーマ
- kit・trace・runner・CLI の内部パッケージへの依存の向き（AGENTS.md と REQ-047・REQ-083・REQ-123）は変えない。kit の外部の実行時依存は `yaml` だけとする（要件定義の NFR-01）
- 仕様の変更（REQ-046・REQ-047）と、AGENTS.md・CONTRIBUTING.md の依存の記述は、別の change `allow-zod-and-yaml-runtime-deps` で行う。この ADR を書いた change では変えない
- いまの手書きの検査と `packages/core/schema/verify-result.schema.json` を Zod に移す作業は、C-001（WBS の W1-1）で行う

## 見直す条件

- zod の major の更新で、公開する型や JSON Schema の書き出しが変わり、追従の手間がスキーマを手で保つ手間を上回ったとき
- core を使う外部の利用者から、実行時依存を持たないことを求められたとき
- Node.js の標準機能で、スキーマの検証と型の導出ができるようになったとき
