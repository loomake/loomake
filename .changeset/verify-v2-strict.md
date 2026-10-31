---
"@loomake/runner": patch
"@loomake/trace": patch
---

旧形式とローカルの結果を、合格や再利用の根拠から外す。

- `@loomake/runner`：直前の証拠が Evidence 1（verify 1.0.0）なら、外部操作の再試行に再利用せず、新しい検証と Evidence 2 の記録を行う（旧ファイルは削除しない）。完了ゲートに scope:ci の結果が来たら、直しのエンジンを呼ばずに理由を記録して停止する
- `@loomake/trace`：`evidenceProblem` が、local の `summary.pending` が `insufficient` 以上でない記録を拒否する
