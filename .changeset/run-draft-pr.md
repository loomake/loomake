---
'@loomake/runner': patch
'loomake': patch
---

runが新規作成するPRをDraftにする。既存PRの状態とlocal/ciの区別を保ち、Draft作成失敗時にReadyで作り直さない。
