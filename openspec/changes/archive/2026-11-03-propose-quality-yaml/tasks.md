# Tasks

## 1. 品質案と一般合意

- [x] 1.1 A 04d07088 と Issue 821fc1f5 を固定親にし、a470 の REQ-408 root 三件・kit 二件の全文と最初の it への一般合意 assert 一行を追加する。同じ最終試験で RED を確認し、両 Skill 二十行・両 format 四十二行・guide を実装して五件 GREEN と旧 assert の成功を確認する。旧 Req409 二件は Y へ保持する。
- [x] 1.2 strict/spec-only と全差分の行数・固定親基準の自身の差分を確認し、kit patch changeset を追加する。runtime・公開 API・parser/schema・依存・設定・旧字句を保持する。

## 2. 記録と統合確認

- [x] 2.1 d649 の日誌七行を同日 A prefix の後へそのまま保持して X 結果を追記する。旧誤根拠不採用→7ff 分割採用、B2 160c の六 Scenario/spec15、C3 監視 audit（#310/REQ180183 の raw byte・別上限・既存監視接続欠落）と通常設計中、DOC3 質問未投稿、main7d・JST closed0（root 01:39 観測）を必要な判断結果だけ四項目へ集約し、長い経過や session/SHA 羅列を日誌へ書かない。
- [x] 2.2 `pnpm -s verify --change propose-quality-yaml --done --scope local` を通常実行で通す。 <!-- loomake:gate=done -->

## Workflow follow-up

- 同じ実装 PR で同期/archive を行い、親 main 後に自身の最終差分を再確定する。非作者自己レビュー・独立最終レビュー・軽微 Issue 化・必須 CI/kit 三 OS・merge 直前 head 照合を確認し、X→Y→B2 の最終受入順を守る。旧 branch の reset・試験削除・WT 削除は行わない。


## 一括受入への移行（2026-11-05）

上の Workflow follow-up は個別 PR を想定した履歴として保持する。管理役は、6 change の全要件・Scenario・タスク・trace と Issue → A → X → Y → Apply → Report の順を保ち、通常 L3 の 1 PR で一括受入する方針を採用した。「親 main 受入後の再確定」は、一括 main 受入前に6段すべての依存・結合と必要な実観測を再確定する手順へ置き換える。

段階受入の例外は使わない。新しい独立 Opus が累積全差分を読み、重大0、必須5チェック、kit の3 OS、6 change それぞれの通常 CI 完了ゲート（scope ci）を確認する。旧 head の成功を新 head の実行済みと扱わず、未完了の検証は残す。親 #66 の完了は、実観測と全受入条件を確認して別に判断する。
