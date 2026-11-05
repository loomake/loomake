---
"@loomake/core": minor
"@loomake/trace": minor
---

実績記録の空の費用配列を拒否し、日時を秒必須にそろえる。費用が不明なAPI入力はcostを省略し、実額0はkindとcents:0を明記する。保存後の片付け・通知失敗ではRuntimeFailureで保存済みを案内する。移行方法は人の実作業時間のガイドを参照。
