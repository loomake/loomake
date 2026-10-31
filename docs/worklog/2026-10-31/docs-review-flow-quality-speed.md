# レビューの流れの規則の追記（quality-speed-plan の Q1・Q2・Q3・Q5、A1）

1. やったこと：ADR 0006 のレビュー規則に、独立 Opus への依頼文を「差分 ＋ 変更した REQ ID の一覧 ＋ 読むべきファイルの一覧」とし、200KiB の上限を差分だけに掛ける決定を足し、review-request.md と delivery スキルをそれに合わせた。delivery スキルに Opus 依頼前の自己レビュー、24 時間以上の Draft が 2 本あるときの L3 停止、origin/main からの worktree を足し、docs/dev/review-checklist.md を新設した。
2. verify の結果：change はないので verify は対象外。`pnpm lint`・`pnpm typecheck`・`pnpm test` は成功した。
3. 残っている確認事項・仮定：ask-opus.mjs は依頼ファイル全体を 200KiB で拒むため、差分が上限近くのときは依頼が拒まれる。コードは変えず PR 本文で報告した。設計依頼（design-request.md）の形は変えていない。
4. 次にやること：管理役が独立 Opus レビュー（L2、1 回）を依頼し、CI と合わせてマージを判断する。
