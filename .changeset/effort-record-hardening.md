---
"@loomake/core": minor
"@loomake/trace": minor
"loomake": minor
---

実績記録の空の費用配列を拒否し、日時を秒必須にそろえる。費用が不明なAPI入力はcostを省略し、実額0はkindとcents:0を明記する。保存後の片付け・通知失敗ではRuntimeFailureで保存済みを案内し、CLIの終了コードを2から3へ変える。core・trace・loomakeはまだ0.0.0で、これは未公開のリポジトリ内実装からの移行案内である。移行方法は人の実作業時間のガイドを参照。
