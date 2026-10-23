---
"@loomake/kit": patch
---

`loomake init` は、package.json の依存に loomake がないとき、開発用の依存に足すコマンドを案内する。package.json がないときは、loomake.config.json の commands を書き換えるよう案内する。
