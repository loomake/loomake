---
"@loomake/kit": minor
---

外部操作の監視役が結果を書かずに終わったとき（Windows で `process.kill(pid, 'SIGINT')` により強制終了されたときなど）に、使い方の誤りとして返さず、監視役から先に受け取った PID で対象の子孫を止める。理由を含む中断（`ProcessLimitError`、kind は `interrupted`）として返し、同じ共有予算の後続の操作を始めない。`ProcessLimitError` に、利用者の中断と区別する理由の `reason` を足す。

Windows では、監視役と一緒に終わった cmd.exe の子が残ることがある。そこで、外部操作の環境変数 `LOOMAKE_SUPERVISOR_MARK` に実行ごとの印を足し（外側の印は残す）、監視役が結果を書かずに終わったときは、PowerShell を 1 回だけ起動して、印を持つと確かめたプロセスだけを、確かめたのと同じハンドルで止める。印がない・確かめられない子孫は止めずに未確認とする。この後片付けは PowerShell の起動を含めて 10 秒までとし、通常の共有予算は延ばさない。子孫の停止を確認できなかったときは、中断の理由に「子孫の停止を確認できません」とその理由を加え、`ProcessLimitError` の `cleanup` にも結果を入れる。
