---
"@loomake/runner": patch
"loomake": patch
---

`loomake run` の git の設定とフックの比較で、include の先や利用者全体の設定も比べ、フックのシンボリックリンクはたどらずに比べる。リンク先のないフックがあっても落ちない。テストの検査の行から、コメントと import・require の行を除く。
