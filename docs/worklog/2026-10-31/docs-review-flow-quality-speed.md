# レビューの流れの規則の追記（quality-speed-plan の Q1・Q2・Q3・Q5、A1）

1. やったこと：ADR 0006 のレビュー規則に、独立 Opus への依頼文を「差分 ＋ 変更した REQ ID の一覧 ＋ 読むべきファイルの一覧」とし、200KiB の上限を差分だけに掛ける決定を足し、review-request.md と delivery スキルをそれに合わせた。delivery スキルに Opus 依頼前の自己レビュー、24 時間以上の Draft が 2 本あるときの L3 停止、origin/main からの worktree を足し、docs/dev/review-checklist.md を新設した。
2. verify の結果：change はないので verify は対象外。`pnpm lint`・`pnpm typecheck`・`pnpm test` は成功した。
3. 残っている確認事項・仮定：ask-opus.mjs は依頼ファイル全体を 200KiB で拒むため、差分が上限近くのときは依頼が拒まれる。コードは変えず PR 本文で報告した。設計依頼（design-request.md）の形は変えていない。
4. 次にやること：管理役が独立 Opus レビュー（L2、1 回）を依頼し、CI と合わせてマージを判断する。

## 独立 Opus レビュー（最終 1 回目）への対応

1. やったこと：head 9c8dcd4 のレビュー（重大 0・軽微 7・情報 5）の軽微 7 件を直した。ask-opus.mjs の上限は Issue #207 に記録し、テンプレートに直るまでの制約を書いた。自己レビューの記録先（`process:` 行）、「起草」の意味、重大が消えないときの扱い、worktree の文、PR の数え方、テンプレートの古い記述、チェックリストの出典を直した。
2. verify の結果：change はないので verify は対象外。`pnpm lint`・`pnpm typecheck`・`pnpm test` は成功した。
3. 残っている確認事項・仮定：PR の数え方は管理役の指示で、Draft だけでなく Ready も含め、マージ条件を満たしていない PR を数える形にした。Q3 の決定の「Draft」より広い。
4. 次にやること：指摘の修正だけなので、ADR 0006 に従い再レビューは不要と管理役が判断する。CI を確かめてマージを判断する。
