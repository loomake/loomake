---
"@loomake/kit": minor
"@loomake/runner": patch
"loomake": patch
---

`loomake run` の git commit・git push・gh pr create は、1 操作 30 秒の期限ではなく、run の残り時間で止める。30 秒を超える pre-commit・pre-push のフックがあっても、タスクごとに止まらない。外部操作に、1 操作の期限を使わない `untilDeadline` の指定を足す。
