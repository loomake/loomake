# 速度対策1-1（PR184）

1. `split-slow-ci-checks`のtask2.1〜2.4の先行実装とtask3.1のmain統合に続き、task4.2のpush専用3OS×3sample測定と元JSON・固定項目のmetadata保存を準備した。過去の作業・失敗・検証の経緯は[固定済みのworklog](https://github.com/loomake/loomake/blob/0df1531699573e2f6ff4744c0a80f3bcf1c0330e/docs/worklog/2026-10-31/ci-split-slow-tests.md)に残し、旧レビュー条件は現行条件として扱わない。
2. main統合時の通常verifyは1647成功・失敗0・既存skip8で、初回の引数誤りによる品質コマンド前の停止も原本を保持した。今回のstrict/spec-only・型・lint・関連32試験が成功し、実設定のcollectで15fileがunit13/package2へ過不足なく選択されることを確認したため、通常fullは反復していない。
3. 元case・parameter・全assertion・timeout・skipとcoverage94/89/96/97、REQ-297の元4case・19.5/39.5秒下限・既存上限・保持役待ち差分だけの時計・retryを保持する。task2.4のfast確定・task3.1/3.2/4.2・3OS各3sampleは未完了で、5/15と必須受入3件未実施を維持し、PR190の実修理・5夜成功も完了としていない。
4. [PR184](https://github.com/loomake/loomake/pull/184)の管理役による差分確認とcommit/push後、同じheadを計測branchへ送り、元14fileと新fast file全17caseの実JSON timingから残10fileの設計材料を得る。旧179専用workflowとcase分割・新しいprofiler挙動は加えず、実測・改訂ADR 0006のレビュー・人のnode20-only規則操作・マージとsync/archiveの受入を残す。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [184](https://github.com/loomake/loomake/pull/184) | 未測定（既存設計を再利用、残10file未設計） | 進行中 | 未測定（main統合・測定準備後は未実行） | 未集計（最終レビュー未実施） | 未マージ・未測定 |

2026-10-31 JSTの測定準備時点の途中記録。全工程の開始時刻は未測定であり、過去の局所作業開始から全体所要時間を算出しない。
