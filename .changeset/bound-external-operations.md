---
"@loomake/kit": minor
"@loomake/trace": minor
"@loomake/runner": minor
"loomake": minor
---

Git・gh・エンジンの存在確認・OpenSpec検証に1操作30秒の期限を設け、run全体の残り時間と共有する。共通監視で時間・出力超過・中断と子プロセスの停止を扱う。期限後も検証用のタスクの完了印を元へ戻し、作業と証拠・PRの再試行を保つ。従来は待ち続けた遅い操作も停止するため、対象と移行時の確認を文書へ記載する。
