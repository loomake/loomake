## 1. 計画

- [x] 1.1 計画・REQ-388と全6 Scenarioを記録し、strict・仕様ゲート終了0、本文500 UTF-16以内、独立レビューのID/保持条件を確認する
- [x] 1.2 C2bの同期・archiveがmainへ入ったことを確認して取り込む。未完なら実装を始めない

## 2. 実装

- [x] 2.1 新しいT-C3A-01〜06を先に書き、モジュール不在のREDを保存する
- [x] 2.2 ownerBlockへexportとlogical・sourcesだけを足し、既存trusted試験を無変更で通す
- [ ] 2.3 C001専用入口と深く凍結した固定例外を実装し、全6 Scenarioの正負例をGREENにする

## 3. 受入

- [ ] 3.1 全体品質・3OS・既存試験/期待値/期限/設定不変・公開exports/依存不変と全差分約300行を確認し記録する。超過時は受入を削らず設計へ戻る
- [ ] 3.2 通常local doneを終了0にし、CI gateのscope ci・必須5チェック・独立Opus重大0を確認する（REQ-388） <!-- loomake:gate=done -->
