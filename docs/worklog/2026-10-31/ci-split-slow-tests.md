# 速度対策1-1（PR184）

1. `split-slow-ci-checks`のtask2.1〜2.4を先行実装し、task3.1の途中作業として[PR184](https://github.com/loomake/loomake/pull/184)へmainを取り込み、隔離とroot共有build・空registryを両立させた。過去の作業・失敗・検証の経緯は[固定済みのworklog](https://github.com/loomake/loomake/blob/0df1531699573e2f6ff4744c0a80f3bcf1c0330e/docs/worklog/2026-10-31/ci-split-slow-tests.md)に残し、旧レビュー条件は現行条件として扱わない。
2. strict/spec-only・型・lint・関連122試験、同じ設定を使う独立fixtureの8経路、通常verify（1647成功・失敗0・既存skip8）が成功した。通常verifyの初回は引数誤りで品質コマンド前に止まったため原本を保持して正しい引数で実行し、publication・配布物操作の元試験定義とassertion・timeoutの一致も構文で確認した。
3. 元case・parameter・全assertion・timeout・skipとcoverage94/89/96/97、REQ-297の元4case・19.5/39.5秒下限・既存上限・保持役待ち差分だけの時計・retryを保持する。task2.4のfast確定・task3.1/3.2・3OS各3sampleは未完了で、5/15と必須受入3件未実施を維持し、PR190の実修理・5夜成功も完了としていない。
4. 管理役の差分確認後にmerge commit/pushへ進み、既存設計内のtask4.2測定準備を先行して残10fileの設計材料を得る。旧179専用workflowは復活させず、未設計case分割と新しいprofiler挙動は加えず、改訂ADR 0006に従うレビュー・人のnode20-only規則操作・マージとsync/archiveの受入を残す。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [184](https://github.com/loomake/loomake/pull/184) | 未測定（既存設計を再利用、残10file未設計） | 進行中 | 未測定（main統合後は未実行） | 未集計（最終レビュー未実施） | 未マージ・未測定 |

2026-10-31 JSTのmain統合作業時点の途中記録。全工程の開始時刻は未測定であり、過去の局所作業開始から全体所要時間を算出しない。
