# C001 の分割 2a「読む側の対応」（verify-v2-readers）

1. やったこと：PR #197 の差分が 200KiB を超えたため、管理役の決定で 2 本目を読む側（2a）と書く側（2b）に分けた。子 change `verify-v2-readers` のタスク 1.1〜3.1 を実施した。親から REQ-205 を移し、REQ-093 は承認済み R-C001-05 A の MODIFIED を確定した。runner の完了ゲート・仕様ゲート・記録・PR 本文・証拠の再利用、trace の `evidenceProblem`、kit の `formatVerifyResult`、ci-gate の判断関数 `ciGateProblem` が verify 2.0.0 と Evidence 2 を読めるようにした。書き出しは 1.0.0 と Evidence 1 のままで、既存試験の期待値は変えていない。changeset は kit・trace・runner の patch。
2. verify の結果：`pnpm -s verify --change verify-v2-readers --spec-only` と `--done` は exit 0（試験 1,676 件成功・skip 8 件）。親 `verify-v2-c001` の `--spec-only` も exit 0。既存試験の行の削除は 0 行。
3. 残っている確認事項・仮定：仮定 A-01（2.0.0 では scope:local の終了コード 0 だけを完了とする）は承認待ち。REQ-317・100・164・318・073・040・041・311・315 は、書き出しの切替が要るので 2b（`verify-v2-wiring`）に残した。
4. 次にやること：管理役が 2a を確かめてマージしたあと、PR #197 を 2a の上に 2b として作り直す。REQ-050 の試験は、レポートの解析を含む処理量の確認を 2b の中に残す。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| change/verify-v2-readers | 対象外（管理役の分割の決定に従う） | 約 10 分（worktree 作成 11:48 JST から完了ゲート成功 11:58 JST まで） | 未実施 | 0 | 未実施 |
