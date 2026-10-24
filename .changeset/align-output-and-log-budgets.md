---
"@loomake/runner": minor
"loomake": patch
---

`loomake run` のエンジンの出力の既定の上限を 64MiB から 16MiB に下げる。完了ゲートと直しの出力が、1 回の実行の記録の上限（128MiB）に収まるようにする。`run.maxOutputBytes` で、これまでどおり変えられる。
