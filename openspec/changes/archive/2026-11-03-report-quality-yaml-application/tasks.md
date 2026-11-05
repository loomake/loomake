# Tasks

## 1. 反映結果の報告

- [x] 1.1 Apply の実装最終 head を local 親に固定し、元 checkpoint 13e9817e の REQ-411 root 二ケースを同じ describe へ全文移管する。追加報告の RED と旧報告互換の PASS を確認し、両 Skill Step 7 の各六行と guide を追加して二件 GREEN・Apply 四件と旧 assert 成功を確かめる。
- [x] 1.2 strict/spec-only・全量と固定親基準の自身の差分を確認する。親の日誌 prefix を保持して子の判断結果を四項目へ短く追記し、kit patch changeset を含める。format・kit 試験・元 B2 branch は変更しない。

## 2. 統合確認

- [x] 2.1 `pnpm -s verify --change report-quality-yaml-application --done --scope local` を通常実行で通す。 <!-- loomake:gate=done -->

## Workflow follow-up

- 同じ実装 PR で主仕様同期/archive を行い、親 main 受入後に自身の最終差分を再確定する。非作者自己レビュー・独立最終レビュー重大ゼロ・軽微 Issue 化・必須 CI/kit 三 OS・merge 直前 head 照合を確認し、Apply→Report の最終受入順を守る。


## 一括受入への移行（2026-11-05）

上の Workflow follow-up は個別 PR を想定した履歴として保持する。管理役は、6 change の全要件・Scenario・タスク・trace と Issue → A → X → Y → Apply → Report の順を保ち、通常 L3 の 1 PR で一括受入する方針を採用した。「親 main 受入後の再確定」は、一括 main 受入前に6段すべての依存・結合と必要な実観測を再確定する手順へ置き換える。

段階受入の例外は使わない。新しい独立 Opus が累積全差分を読み、重大0、必須5チェック、kit の3 OS、6 change それぞれの通常 CI 完了ゲート（scope ci）を確認する。旧 head の成功を新 head の実行済みと扱わず、未完了の検証は残す。親 #66 の完了は、実観測と全受入条件を確認して別に判断する。
