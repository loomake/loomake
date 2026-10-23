---
"@loomake/kit": patch
---

`loomake verify` の仕様ゲートに「同じ確認事項の回答」の検査を足した。質問に「<change-id> の Q-xx と同じ質問」と書いた確認事項は、参照先の change の回答と比べ、違えば不合格にする。
