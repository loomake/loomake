---
"@loomake/kit": patch
"@loomake/trace": patch
"@loomake/runner": patch
---

`loomake run` は、エンジンが change の文書（tasks.md・差分仕様など）を書き換えても止まる。仕様と change の文書の場所には、loomake.config.json の `openspecDir` を使う。完了ゲートの品質コマンドにも実行時間の上限を効かせ、テストのレポートが `.gitignore` で除外されていなければ始めない。skip の検出に `skipIf`・`runIf`・`it.concurrent.skip` などを足した。verify・run・trace は、`/`・`\`・`..` を含む change-id を使い方の誤りにする。trace report は、JSON として読めない証拠の記録があれば、そのファイルを示して使い方の誤りにする。
