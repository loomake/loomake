---
"@loomake/runner": minor
"@loomake/kit": patch
---

`loomake run` は、完了ゲートのタスクを、行の `<!-- loomake:gate=done -->` の印で決める。印のない旧書式（本文に `verify` と `--done` を含むタスク）も受け付け、印を付けるよう案内する。エンジンへの指示・コミットのメッセージ・実行の記録には、印を除いた文を使う。run を始めたあとの git の失敗と証拠の記録の失敗は、実行の記録に理由を書いて終了コード 1 で止まる。始める前の git の失敗は、これまでどおり終了コード 2 にする。req-to-openspec Skill の tasks.md の雛形に、完了ゲートのタスクの印を足した。
