---
"@loomake/trace": minor
---

`loomake trace record` は、検証した時点の trace.md と差分仕様の内容・パス・SHA-256 を証拠に保存する。検査のあいだに HEAD・作業ツリー・文書が変わったら記録しない。`loomake trace report` は、証拠に保存した文書から表を作り、記録のあとで変わった文書を冒頭に示す。文書を保存していない古い記録では、合格を「合格（仕様との対応は未確認）」と表示する。レポートに検査の範囲の説明を足し、レポートの JSON の `schemaVersion` を 2 に上げた。
