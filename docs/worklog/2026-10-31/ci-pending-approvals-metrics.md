# 利用者の判断待ちを delivery-metrics に足す

1. やったこと：`scripts/delivery-metrics.sh` が `pending-approvals.csv` も書くようにした。判定は `scripts/pending-approvals.mjs` の純粋な関数に置き、Issue #121 の呼びかけ、待ちと書いた開いている PR、main の trace.md の未回答のブロッキングな確認事項の 3 種類を集める。trace.md の判定は verify と同じ core の `parseTrace`・`createAgreement` と kit の `evaluateAgreement` を使う。
2. verify の結果：change はないので verify は対象外。`pnpm lint`・`pnpm typecheck`・`pnpm test` は通った。実データで 1 回流すと、issue121 が 0 件、pr が 1 件、trace が 0 件だった。
3. 残っている確認事項・仮定：Issue #121 のコメントは、どれも投稿者が利用者のアカウントになる。そこで、App を通さない投稿があとにあれば回答済みとみなす。Claude が利用者の gh のトークンで投稿したコメントも回答として数えてしまう制約が残る。
4. 次にやること：独立した Opus のレビューを受け、指摘があれば直す。
