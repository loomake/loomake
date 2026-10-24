---
"loomake": patch
---

サブコマンドの `--help` に、説明と各オプションの説明を載せた。`trace record --help` と `trace report --help` は、それぞれの使い方を出す。値を取るオプション（`--change`・`--engine`・`--format`）は `--change=<id>` の形でも受け付け、知らないコマンドを指定したときはその名前を挙げて知らないと表示する。
