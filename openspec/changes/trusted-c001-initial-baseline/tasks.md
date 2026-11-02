## 1. 計画

- [x] 1.1 C2aの通常受入・同期・archiveを確認し、REQ-378本文と全5 Scenario・9採否不変、strictと仕様ゲートの終了0を確認する

## 2. 全記録と試験

- [x] 2.1 元JSON保護6件を1410 bytes・名前・本文・期待値・期限まで不変で移し、6件を成功させる
- [x] 2.2 実記録の変異・閉じたYAML・alias予算・主体未検証のREQ-378試験を先に書き、記録/PIN不在のREDを保存する。Issue #317のtop-level負例も正しい基準と理由で強化する
- [x] 2.3 全候補・9採否参照・私的PIN定数を記録し、全15件数とPython/Node独立2経路のdigestを固定して全正負例をGREENにする

## 3. 統合

- [x] 3.1 全体品質・固定coverage・レイヤー・元試験/期待値/期限/設定不変・全409参照の各1成功・全差分200KiBを確認し記録する。超過なら受入を削らず設計へ戻る
- [x] 3.2 通常local doneの実終了0を確認する <!-- loomake:gate=done -->

最終の合格は同じheadのCI scope ci・verdict PASS・completed・errors空・要判断なし、必須5チェック・3OS・別担当自己レビュー・独立Opus・Codexで確認する。

## Workflow follow-up

- 受入後に同期・archiveし、C3以降・S1・親・live・S2の全受入へ進む。
