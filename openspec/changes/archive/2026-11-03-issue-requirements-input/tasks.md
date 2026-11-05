## 1. 仕様と予算
- [x] 1.1 採用した301行見込からの実差分増加を早期報告し、全9 Scenario・保持契約・REQ重複を確認してstrict/spec-onlyの実exit0を保存する。

## 2. Skill と互換試験
- [x] 2.1 REQ-402〜404の構造試験と本文/コメント出典の未回答1→回答後0の互換試験を追加し、旧assert不変と不足指示のREDを確認する。
- [x] 2.2 両Skill・trace雛形・案内を追随し、新試験と旧kit-assets/verify回帰・lint/typeを成功させる。AI実生成の観測は静的試験と分けて記録し、旧A-01を保持する。

## 3. 完了ゲート
- [x] 3.1 全task・要件対応試験・changeset・日別記録をそろえ、通常localdoneの全品質と実JSON/exit0を確認する。 <!-- loomake:gate=done -->

## Workflow follow-up
- 自身の仕様同期・archiveを実装PRに同梱し、最終CIの通常done・必須5・kit3OS・非作者自己レビュー・独立Opus重大0を確認する。plan-onlyPRは作らない。#66の品質側と親C001は未完として残す。


## 一括受入への移行（2026-11-05）

上の Workflow follow-up は個別 PR を想定した履歴として保持する。管理役は、6 change の全要件・Scenario・タスク・trace と Issue → A → X → Y → Apply → Report の順を保ち、通常 L3 の 1 PR で一括受入する方針を採用した。「親 main 受入後の再確定」は、一括 main 受入前に6段すべての依存・結合と必要な実観測を再確定する手順へ置き換える。

段階受入の例外は使わない。新しい独立 Opus が累積全差分を読み、重大0、必須5チェック、kit の3 OS、6 change それぞれの通常 CI 完了ゲート（scope ci）を確認する。旧 head の成功を新 head の実行済みと扱わず、未完了の検証は残す。親 #66 の完了は、実観測と全受入条件を確認して別に判断する。
