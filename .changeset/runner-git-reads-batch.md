---
"@loomake/runner": patch
---

`loomake run` がエンジンの前後と完了ゲートの前後で読む HEAD・ブランチ名・git の設定ファイルとフックの場所を、境目ごとに 1 回の `git rev-parse` で読むようにする。外部操作の数が減り、run が速くなる。止まる条件と表示は変わらない。
