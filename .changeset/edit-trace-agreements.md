---
"@loomake/core": minor
"@loomake/trace": minor
"loomake": minor
---

`loomake trace answer` で確認事項の回答・回答者・回答日を、`loomake trace approve` で仮定の承認・承認者・承認日を trace.md に書く。すでに値がある行は上書きしない。core に、表の行に値を書く純粋な関数 `setTraceCells` を足す。
