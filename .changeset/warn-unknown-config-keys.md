---
"@loomake/kit": patch
---

loomake.config.json の知らないキー（`comands` のような打ち間違いを含む）を、`loomake verify` では警告、`loomake doctor` では注意として示すようにした。不合格にはしない。
