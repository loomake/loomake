---
"@loomake/core": patch
"@loomake/kit": patch
"@loomake/trace": patch
"@loomake/runner": patch
---

評価で見つかった穴を直した。

- change-id を OpenSpec の change 名の形（英小文字・数字と、間に 1 つずつのハイフン）に限り、`archive` も使い方の誤りにした（verify・trace record・trace report・run）
- 仕様ゲートは、ブロッキング列の `はい` もブロッキングとみなし、yes・no・はい・いいえ 以外の値を不合格にする
- tasks.md の `*`・`+` の箇条書きもタスクとして読み、タスクの無い tasks.md は完了ゲートで不合格にする
- 検収レポートは、使った証拠の検査が不合格なら、冒頭に不合格の検査を示す。JSON の `attention` に `failedChecks` を足した
- `loomake run` は、gh CLI が使えるかを、エンジンを呼ぶ前に確かめる
