---
"@loomake/kit": patch
"@loomake/trace": patch
"@loomake/runner": patch
---

change の差分仕様の探し方と、archive からの change の探し方を kit の 1 か所にまとめた（`specFiles`・`findChangeDir`・`toPosix`）。trace record が証拠に保存する差分仕様と、run がエンジンに渡す差分仕様も、verify と同じく `node_modules` とドットで始まる名前を見ないようにした。
