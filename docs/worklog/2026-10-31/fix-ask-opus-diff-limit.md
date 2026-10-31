# ask-opus.mjs の 200KiB 上限を差分だけに掛ける（Issue #207）

1. やったこと：`--role review` の依頼では、review-request.md の差分欄を囲む区切り行の間だけを 200KiB の上限で数えるように ask-opus.mjs を直した。区切り行が 1 組そろっていない依頼と、design・second-opinion の依頼は、従来どおり依頼全体で数える。
2. verify の結果：change はないので verify は対象外。`pnpm lint`・`pnpm typecheck`・`pnpm test` は成功した。
3. 残っている確認事項・仮定：review で区切り行がそろった依頼は、依頼全体の大きさに上限を掛けない（ADR 0006 の Q1 どおり）。差分欄の境界はテンプレートに足した区切り行で決めた。
4. 次にやること：管理役が独立 Opus レビュー（L2、1 回）を依頼し、CI と合わせてマージを判断する。

## 自己レビュー（head 016592da、重大 0・軽微 4）への対応

1. やったこと：軽微 4 件を直した。全工程で依頼全体に 1MiB の安全弁を残し、CRLF の差分は改行の CR も含めた元のバイト数で数えるようにした。review-request.md に区切り行の置き方と 1MiB の安全弁を書き、PR 本文の仮定 A-01 と証跡の process 行を直した。
2. verify の結果：change はないので verify は対象外。`pnpm lint`・`pnpm typecheck`・`pnpm test` は成功した。
3. 残っている確認事項・仮定：1MiB は Q1 の 200KiB とは別の上限で、差分を区切り行の外に貼る抜け道への天井として置いた。
4. 次にやること：管理役が独立 Opus レビュー（L2、1 回）を依頼し、CI と合わせてマージを判断する。
