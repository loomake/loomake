---
"@loomake/kit": minor
"@loomake/trace": patch
"@loomake/runner": patch
---

verify 2.0.0 の結果と Evidence 2 を読めるようにする（追加だけ）。書き出しは 1.0.0 と Evidence 1 のまま。既存の振る舞いで変わるのは、run の仕様ゲートが例外で止まったときに、切り替えた change のブランチから元のブランチへ戻すことだけ。

- `@loomake/kit`：`formatVerifyResult` が 2.0.0 の結果も文にする。`isVerifyResultV2`・`isAbortedResult` を足す
- `@loomake/trace`：`evidenceProblem` が Evidence 2（verify 2.0.0）も検査し、report が正しい Evidence 2 を読む
- `@loomake/runner`：完了ゲートの結果が 2.0.0 なら、要判断と aborted では直しに進まず止まり、scope:local の完了だけを完了とみなす。仕様ゲートの 2.0.0 の aborted では終了コード 2・3 で止まる。証拠の再利用と PR 本文も Evidence 2 を読む
