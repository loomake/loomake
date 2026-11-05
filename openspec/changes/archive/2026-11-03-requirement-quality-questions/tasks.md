# Tasks

## 1. 五項目と FR-03

- [x] 1.1 Issue 子の固定最終 head をローカル依存として確認・取り込み、両 Skill と trace 雛形に REQ-406/407 を追加する。七 Scenario の構造・解析試験と利用ガイドを同じコミット群に含め、旧六分類・旧三表・両 Skill の一致を既存試験と追加試験で確かめる。
- [x] 1.2 `packages/kit/test/verify.test.ts` に品質節と関連 REQ つき blocking Q の対比較を追加し、未回答の exit 1・Q-ID と回答後の exit 0 を確認する。旧テスト・期待値・設定を保持する。

## 2. 統合確認

- [x] 2.1 strict と spec-only を実行し、日誌に判断・結果を記録し、kit の patch changeset を追加する。全差分の行数を確認し、固定した Issue 子の最終 head をローカル依存として自身の差分を固定する。
- [x] 2.2 `pnpm -s verify --change requirement-quality-questions --done --scope local` を通す。 <!-- loomake:gate=done -->

## Workflow follow-up

- Issue 子の main 受入後、同じ作業 PR の最終受入前に自身の差分を再確定する。同じ実装 PR で主仕様へ同期して archive する。旧仕様・Scenario・assert を保持し、必須 CI・必要な三 OS と独立最終レビュー重大 0 を確認する。軽微は Issue にし、merge 直前の head を照合する。


## 一括受入への移行（2026-11-05）

上の Workflow follow-up は個別 PR を想定した履歴として保持する。管理役は、6 change の全要件・Scenario・タスク・trace と Issue → A → X → Y → Apply → Report の順を保ち、通常 L3 の 1 PR で一括受入する方針を採用した。「親 main 受入後の再確定」は、一括 main 受入前に6段すべての依存・結合と必要な実観測を再確定する手順へ置き換える。

段階受入の例外は使わない。新しい独立 Opus が累積全差分を読み、重大0、必須5チェック、kit の3 OS、6 change それぞれの通常 CI 完了ゲート（scope ci）を確認する。旧 head の成功を新 head の実行済みと扱わず、未完了の検証は残す。親 #66 の完了は、実観測と全受入条件を確認して別に判断する。
