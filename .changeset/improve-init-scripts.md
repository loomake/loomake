---
"@loomake/kit": minor
"loomake": patch
---

`loomake init` は、package.json に `scripts` があるとき、lint・typecheck・test のうち実在する script のコマンドだけを `commands` に書き、書かなかった名前を案内する。依存に vitest か jest があれば、そのテストランナーのレポートの設定例だけを表示する。
