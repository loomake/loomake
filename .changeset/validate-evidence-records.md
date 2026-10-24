---
"@loomake/trace": patch
---

`loomake trace report` は、証拠の記録の `schemaVersion` が読める版でないとき、レポートが使う欄の形が違うとき、記録の `change` が change-id と違うときに、そのファイルと理由を示して終了コード 2 で止まるようにした。読み違えたまま検収レポートを作らないため。
