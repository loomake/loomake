---
"@loomake/runner": patch
"loomake": patch
---

`loomake run` は git に `GIT_TERMINAL_PROMPT=0` を渡し、端末での入力を求めずに失敗させる。commit・push が認証や署名の入力のために失敗したときは、ssh-agent・credential helper・gpg-agent を使って入力なしで動くようにする案内を、止まった理由に添える。
