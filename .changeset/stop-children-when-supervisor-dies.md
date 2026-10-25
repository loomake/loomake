---
"@loomake/kit": minor
---

外部操作の監視役が結果を書かずに終わったとき（Windows で `process.kill(pid, 'SIGINT')` により強制終了されたときなど）に、使い方の誤りとして返さず、監視役から先に受け取った PID で対象の子孫を止める。理由を含む中断（`ProcessLimitError`、kind は `interrupted`）として返し、同じ共有予算の後続の操作を始めない。`ProcessLimitError` に、利用者の中断と区別する理由の `reason` を足す。
