# Tasks

## 1. 適用と保持

- [x] 1.1 Y dda1ade7 を local 親に固定し、元 checkpoint 13e9817e の REQ-410 root 三ケース全文を追加する。同じ最終試験で RED を確認し、両 Skill Step 5 の各八行をそのまま移管して GREEN と旧 assert 成功を確認する。Step 7 の旧報告は変えない。
- [x] 1.2 元 checkpoint の両 format 五十二行と kit 保持例二十一行を全文移管し、合意更新と対象外の値・コメント・未知キー・順序・ID の照合を確認する。全 assert を保持し、抜粋の parse を loaded・実生成・人判断の成功としない。guide は適用・保持の案内だけを加える。

## 2. 記録と統合確認

- [x] 2.1 strict/spec-only・全量と固定親基準の差分を確認する。Y の日誌 prefix と元 checkpoint の判断結果七行を保持して子の結果を四項目へ短く追記し、kit patch changeset を含める。元 branch の全六試験・履歴は削除/reset しない。
- [x] 2.2 `pnpm -s verify --change apply-quality-yaml --done --scope local` を通常実行で通す。 <!-- loomake:gate=done -->

## Workflow follow-up

- 同じ実装 PR で主仕様同期/archive を行い、親 main 受入後に自身の最終差分を再確定する。非作者自己レビュー・独立最終レビュー重大ゼロ・軽微 Issue 化・必須 CI/kit 三 OS・merge 直前 head 照合を確認し、Apply→Report の最終受入順を守る。許可済み local 先行は止めない。


## 一括受入への移行（2026-11-05）

上の Workflow follow-up は個別 PR を想定した履歴として保持する。管理役は、6 change の全要件・Scenario・タスク・trace と Issue → A → X → Y → Apply → Report の順を保ち、通常 L3 の 1 PR で一括受入する方針を採用した。「親 main 受入後の再確定」は、一括 main 受入前に6段すべての依存・結合と必要な実観測を再確定する手順へ置き換える。

段階受入の例外は使わない。新しい独立 Opus が累積全差分を読み、重大0、必須5チェック、kit の3 OS、6 change それぞれの通常 CI 完了ゲート（scope ci）を確認する。旧 head の成功を新 head の実行済みと扱わず、未完了の検証は残す。親 #66 の完了は、実観測と全受入条件を確認して別に判断する。
