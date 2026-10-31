# delivery-metrics を GitHub の REST だけで動かす

1. やったこと：`scripts/delivery-metrics.sh` の `gh pr list`（2 か所）と `gh issue list`（2 か所）を `gh api` の REST に置き換えた。14:05 の毎時 routine が、クラウドのセッションでは GraphQL が 403 になるため CSV を 1 つも作れずに止まったため。PR の行数・ファイル・Codex のコメント数は、PR ごとに REST の 3 つの API を 8 本並べて取る。PR の状態は GraphQL と同じ OPEN・CLOSED・MERGED に、Issue の状態は大文字に直す。`gh run list` はもともと REST なので変えていない。
2. verify の結果：change はないので verify は対象外。同じ手元で直す前と後の台本を続けて流し、5 つの CSV を比べた。違いは、2 回の実行のあいだに起きた変化だけだった（PR #206 のマージ、CI の実行数、当日の worklog の量）。node_modules がない worktree で流し、`pnpm install` から判断待ちの段までを通して終了コード 0 になることも確かめた。
3. 残っている確認事項・仮定：クラウドのセッションで REST が通ることは、routine のログの `gh api repos/loomake/loomake/pulls` の結果で確かめた。台本そのものをクラウドで流すのはマージ後の routine になる。
4. 次にやること：独立 Opus のレビューを受けてマージし、routine を手動で 1 回動かして確かめる。
