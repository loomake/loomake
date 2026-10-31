# 速度対策1-1（PR184）

1. `split-slow-ci-checks`の競合解消としてmain7359d89を取り込み、mainの台帳477件・移行履歴と旧Node20の未確認状態を保ち、REQ-144のpending2件だけを追加した。REQ-214の現行全文・Source・3Scenarioを取得時点付きで追記し、085aの履歴と[固定済みworklog](https://github.com/loomake/loomake/blob/0df1531699573e2f6ff4744c0a80f3bcf1c0330e/docs/worklog/2026-10-31/ci-split-slow-tests.md)を残した。
2. 分割前d3793f76・Node v24.22.1の[計測run41158694094](https://github.com/loomake/loomake/actions/runs/41158694094)では、各3sampleがUbuntu/macOSで250passed・skip0、Windowsで239passed・元skip11となり、OS内case多重集合が一致した。新fast全17caseは全sample成功し、最大はUbuntu2609.111678ms・macOS2571.881667ms・Windows3159.1822msで、今回の元14fileと新fastのd379からの差分は0である。
3. 統合後の通常verifyは1704成功・失敗0・既存skip8、型・lint・関連136試験・strict/spec-onlyが成功し、文書のyomiyasu照合も実施した。既存migrateのdry-runは変更0、fresh reportによるmain監査は両台帳とも確認済449・未確認233・無効13・未知0で、新2件は結果を変えず、元mainの無効13件を確認済みへ戻していない。
4. 7/15と必須受入3件未達を維持し、元case・parameter・全assertion・timeout・skipとcoverage94/89/96/97、REQ-297の元4case・19.5/39.5秒下限・既存上限・保持役待ち差分だけの時計・retryは不変である。task3.1/3.2・case分割・profiler対応・分割後再測定・PR190の実修理と5夜成功は未完了で、独立レビュー・人のnode20-only規則操作・マージとsync/archiveの受入を残す。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [184](https://github.com/loomake/loomake/pull/184) | 未測定（既存設計を再利用、残10file未設計） | 進行中（7/15） | 未測定（7359統合後はローカル検証のみ） | 未集計（最終レビュー未実施） | 未マージ・未測定 |

2026-10-31 JSTの7359統合作業時点の途中記録。d379の計測と統合後の検証を区別し、全工程の開始時刻は未測定のままとする。
