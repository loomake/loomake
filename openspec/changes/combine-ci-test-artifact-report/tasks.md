# Tasks

## 1. 前提と仕様ゲート
- [x] 1.1 M1の受入・同期とQ-C003-01〜03の回答・REQ392予約を確認し、strict/spec-only終了0を確認する（REQ-392）。

## 2. 実装と試験
- [x] 2.1 組の公開変換と型・公開consumer・core changeset・全4 ScenarioのID付き正負試験を加える。関連parser試験と配布物の公開型検査の終了0、既存parser/設定不変を確認する（REQ-392）。

## 3. 完了ゲート
- [ ] 3.1 通常localdoneの全品質・実JSON・実exit0を確認する（REQ-392）。 <!-- loomake:gate=done -->

## Workflow follow-up
- 自身の差分仕様を同期・archiveし、同じ実装PRで全4 Scenario/既存正文の保持とCI通常doneを確認する。同期/archiveだけのPRは作らない。
- 最終受入は必須5チェック・3 OS・独立Opus重大0で確認する。親#62/C003/C001は未完。
