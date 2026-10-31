# 速度対策1-1（PR184）

1. `split-slow-ci-checks`の先行実装とmain統合に続き、管理役が同headの実測・13条件の検出・原本不変を確認したため、task2.4と4.2をチェックした。過去の作業・失敗・検証の経緯は[固定済みのworklog](https://github.com/loomake/loomake/blob/0df1531699573e2f6ff4744c0a80f3bcf1c0330e/docs/worklog/2026-10-31/ci-split-slow-tests.md)に残し、旧レビュー条件は現行条件として扱わない。
2. d3793f76・Node v24.22.1の[計測run41158694094](https://github.com/loomake/loomake/actions/runs/41158694094)で、各3sampleはUbuntu/macOSが250passed・skip0、Windowsが239passed・元skip11で、OS内case多重集合が一致した。新fast全17case（M01〜M13を含む）は全sample成功し、最大はUbuntu2609.111678ms・macOS2571.881667ms・Windows3159.1822msだった。
3. main統合時の通常verifyは1647成功・失敗0・既存skip8、測定準備の型・lint・関連32試験も成功し、今回は文書だけをstrict/spec-onlyで検査してfullを反復しない。元case・parameter・全assertion・timeout・skipとcoverage94/89/96/97、REQ-297の元4case・19.5/39.5秒下限・既存上限・保持役待ち差分だけの時計・retryを保持する。
4. 進捗は7/15で必須受入3件は未達、task3.1/3.2・case分割・profiler対応・分割後の再測定・PR190の実修理と5夜成功は未完了である。10,000ms超の候補表をtask3.2の設計へ渡し、registry割当や旧179専用workflowの復活を行わず、独立レビュー・人のnode20-only規則操作・マージとsync/archiveの受入を残す。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [184](https://github.com/loomake/loomake/pull/184) | 未測定（既存設計を再利用、残10file未設計） | 進行中（7/15） | 未測定（計測9job成功、必須CIの待ち時間は未集計） | 未集計（最終レビュー未実施） | 未マージ・未測定 |

2026-10-31 JSTのd379基準・分割前測定時点の途中記録。全工程の開始時刻は未測定であり、過去の局所作業開始から全体所要時間を算出しない。
