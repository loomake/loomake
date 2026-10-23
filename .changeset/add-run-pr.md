---
"@loomake/runner": minor
---

`loomake run` は、完了ゲートに合格したら `loomake trace record` で証拠を記録してコミットし、ブランチを origin に送って `gh pr create` で PR を作る。本文には proposal の Why と What Changes、完了ゲートの結果、要件ごとのテスト、証拠の記録のパスを載せる。gh にログインしていなければ、記録の前に止まる。
