---
"@loomake/runner": minor
"loomake": patch
---

`loomake run` の不正な直し方の検出で、既存のテストから検査の行（`expect(`・`assert`）を減らす変更と、`expect(true).toBe(true)` のように必ず通る検査を足す変更を止める。検査を整理して数が減る正当な変更も止まるので、人が差分を確かめて承認する。
