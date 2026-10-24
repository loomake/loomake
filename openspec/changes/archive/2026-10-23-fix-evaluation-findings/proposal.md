# fix-evaluation-findings

## Why
2026-10-23 に実装全体を評価した（作業記録 2026-10-23 の 42 節）。そのとき、利用者が受ける害が大きく、小さく直せる穴が 4 つ見つかった。

- 検査が不合格の証拠でも、検収レポートの冒頭に「要注意の要件はありません」と出る
- 完了ゲートが、空の tasks.md と `* [ ]` で書いたタスクを見落とす。仕様ゲートは、ブロッキング列の `はい` を警告なしにブロッキングでない扱いにする
- `loomake run` は gh CLI の有無を最後に確かめるので、エンジンに実装させ終えてから止まる
- change-id の決まりがコマンドごとに違う。Windows の verify では、シェルの記号を含む change-id がそのまま `openspec validate` に渡る

## What Changes
- 検収レポートの冒頭に、使った証拠の検査が不合格であることと、不合格になった検査の名前を示す（REQ-072）
- タスクの箇条書きの記号に `*`・`+` を認める（REQ-014）。タスクが 1 つも無い tasks.md を完了ゲートで不合格にする（REQ-038）
- ブロッキング列の値を yes・no・はい・いいえ に限り、はい もブロッキングとみなす。それ以外の値は仕様ゲートで不合格にする（REQ-034）
- run は、gh CLI が使えるかを、エンジンを呼ぶ前に確かめる（REQ-116）
- change-id を OpenSpec の change 名の形（英小文字・数字と、間に 1 つずつのハイフン）に限り、`archive` も使い方の誤りにする。verify・trace record・trace report・run で同じ検査を使う（REQ-041・REQ-066・REQ-070・REQ-101）

## Non-goals
- run のガードで、テストのアサーションの書き換えやファイルの中のテストの削除を見つけること（評価の指摘のうち、別の change で扱う）
- CLI のヘルプの詳しさ、`--change=<id>` の形、終了コードの揃え直し
- ci-gate.mjs の change の判定の変更

## Impact
- 影響する capability：verify・core-parsers・trace-report・trace-record・run・run-pr（Requirement の変更）
- 影響するコード：`packages/core/src/tasks.ts`、`packages/kit/src/verify/`、`packages/trace/src/report.ts`、`packages/runner/src/run.ts`
