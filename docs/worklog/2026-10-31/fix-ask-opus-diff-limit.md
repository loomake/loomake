# ask-opus.mjs の 200KiB 上限を差分だけに掛ける（Issue #207）

1. やったこと：`--role review` の依頼では、review-request.md の差分欄を囲む区切り行の間だけを 200KiB の上限で数えるように ask-opus.mjs を直した。区切り行が 1 組そろっていない依頼と、design・second-opinion の依頼は、従来どおり依頼全体で数える。
2. verify の結果：change はないので verify は対象外。`pnpm lint`・`pnpm typecheck`・`pnpm test` は成功した。
3. 残っている確認事項・仮定：review で区切り行がそろった依頼は、依頼全体の大きさに上限を掛けない（ADR 0006 の Q1 どおり）。差分欄の境界はテンプレートに足した区切り行で決めた。
4. 次にやること：管理役が独立 Opus レビュー（L2、1 回）を依頼し、CI と合わせてマージを判断する。
