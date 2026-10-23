---
"@loomake/runner": patch
---

`loomake run` の不正な直し方の検出で、HEAD にあったテストファイルのアサーション（`expect`・`assert`）とテストの宣言（`it`・`test`・`describe`）の行を、消すか書き換えたら止まるようにした。同じ内容の行を同じファイルに足していれば、行を移しただけとみなす。
