# 利用者の判断待ちを delivery-metrics に足す

1. やったこと：`scripts/delivery-metrics.sh` が `pending-approvals.csv` も書くようにした（#201）。判定は `scripts/pending-approvals.mjs` の純粋な関数に置き、Issue #121 の呼びかけ、「## 人の判断が必要な項目」に中身がある開いている PR、main の trace.md の未回答のブロッキングな確認事項の 3 種類を集める。独立 Opus レビューの重大 2・軽微 4・情報 1 を 1 コミットで直した。
2. verify の結果：change はないので verify は対象外。`pnpm lint`・`pnpm typecheck`・`pnpm test` は通った。実データで流すと 3 種類とも 0 件で、直す前に数えた #200 は誤検出だった。判断待ちの段だけを失敗させると、ほかの CSV を更新し、前の `pending-approvals.csv` を残して終了コード 1 で終わることも確かめた。
3. 残っている確認事項・仮定：Issue #121 では、App を通さず目印 `<!-- loomake-agent: claude -->` もない投稿を回答とみなす。目印を付け始める前の Claude の直接の投稿は回答として数えてしまう。「- 項目」の箇条書きは、指示の正規表現から外して中身として数えた。
4. 次にやること：独立 Opus の再レビューを受ける。
