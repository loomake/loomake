# 2026-10-28 の作業記録（docs/wbs-to-issues）

## WBS を GitHub Issues に移す（11:00〜）

- やったこと：change なし（作業管理の移行と文書）。利用者の依頼で、WBS v1.4（54 件）を GitHub Issues に移した。`scripts/wbs-to-issues.py`（docs/wbs/migration.md 6.2 の段 0〜2 の実装）で、段階の親 Issue 7 件と作業項目 54 件、sub-issue 54 本、blocked-by 85 本を作った。初期状態の done 6 件（W0-2・W0-4・W0-6・W0-7・W0-8・W6-6）は、利用者の確認のうえで根拠をコメントして completed で閉じた。同じ入力で再実行し、作成・更新・関連付けが 0 件になることを確かめた。1 回目の再実行では、GitHub が本文の末尾に足した署名のために照合がずれて全件が競合になったので、印より後ろを比べないように直した。docs/wbs.md を docs/wbs/baseline-v1.4.md に移し、冒頭の正本の記載を固定版に書き換え、9 章に WBS ID と Issue 番号の対応表を足した。README.md・docs/requirements-matrix.md・docs/guide/4.concepts/2.overview.md の参照先と、docs/wbs/migration.md（v0.8、10 章に実施記録）を直した。
- 完成の目処：残り 48 件を AI を使って約 93 人日と見積もり、WBS 外の作業の比率と並行の度合いで幅を出した。初回完成（段階 5 の出口）は楽観で 2026 年 12 月下旬、標準で 2027 年 1 月末、悲観で 4 月上旬。依存の最短経路は約 31 日分。実績の記録（W0-7）がまだないので、C-001 の完了時に実績と比べて引き直す。
- verify の結果：change がないので verify は実行していない。
- 残っている確認事項・仮定：Projects と Issue fields は、このセッションから Organization の API に触れられないため、管理者の手作業で設定する。W1-12・W6-7 は確度の低い判定のまま開いている。W0-3 は PR #26 で REQ-046・047 の改訂が済んだが、初期状態は partial のまま。
- 次にやること：PR の CI とレビューの結果を確かめる。Projects の作成と Issue fields の設定を利用者に依頼する。

## PR #106 のレビューへの対応

- やったこと：Codex のレビューの P2 を 4 件直した（scripts/wbs-to-issues.py）。(1) `--wbs` と `--source` の既定を docs/wbs/baseline-v1.4.md にし、移したあとも書かれた使い方で動くようにした。(2) `--dry-run` でも既にある Issue の sub-issue と blocked-by を読み、`--apply` で実際に足す分だけを数えるようにした。移行済みのリポジトリで、作成・関連付けがすべて 0 件と出ることを確かめた。(3) タイトルは前回の値を残していないので、生成するタイトルと同じときだけ書き換え、人が直したタイトルは競合として報告するようにした。(4) 初期状態が done の Issue は、今回作ったものだけでなく、開いたままのものも続きから閉じるようにした。根拠のコメントに印を付け、コメントだけ済んで止まった場合は閉じるだけ行い、reopened の記録がある Issue は閉じない。(3)(4) は偽の gh で確かめた。
- verify の結果：change がないので verify は実行していない。
