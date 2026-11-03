## 1. 仕様と前提
- [ ] 1.1 未受入#387の固定C1aを専用WTへ積み、REQ-400契約を確認し、全5Scenario・保持REQ・見積を確定してstrict/spec-onlyの実終了0を確認する。
## 2. 接続と試験
- [ ] 2.1 REQ-401の全分類・混在エラー優先（#386）・宣言なし完全互換・既存判断併存・入力境界と実CLI/JSONの新規試験を先に追加し、意味あるREDを保存する。
- [ ] 2.2 一度読んだtrace本文で内部readerを接続し、新規試験と既存回帰・lint/typecheckを通す。UsageError/abort・4 callers・旧assert/期待/期限/設定を保持し、changesetと説明を同じ作業に含める。
## 3. 完了ゲート
- [ ] 3.1 通常localdoneの全品質・全REQ対応試験・全task・実JSON・実終了0を確認する。 <!-- loomake:gate=done -->
## Workflow follow-up
- C1aのmain受入後に自身差分を再確定し、通常localdone0を確かめて、自身の仕様同期・archiveと日別worklog4項目を同じ実装PRに含め、最終CIのarchive通常done・必須5・3 OS・独立レビューを確認する。親#285と後続の提供元照合は未完として残す。計画だけのPRは作らない。
