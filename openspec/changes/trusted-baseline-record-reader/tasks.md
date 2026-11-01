## 1. 計画

- [x] 1.1 REQ-387・分割配分・全Scenario・回答を記録し、strictと仕様ゲートを通す

## 2. 読取り部品と試験

- [x] 2.1 元14文書による全47契約の合成fixtureとREQ-387付き正負試験を先に追加し、部品が無いREDを保存する
- [x] 2.2 設計どおりの私的checkBaselineRecordと15件数の照合を実装し、全関連試験を成功させる

## 3. 通常の検証

- [ ] 3.1 lint・型・全体試験・build・固定coverage、既存保護対象の不変、全差分200KiB以内を確認し、作業記録を書く
- [ ] 3.2 全タスクを確認して通常local doneを成功させる <!-- loomake:gate=done -->

最終の合格は同じheadのCI gate・必須5チェック・3OS・別担当自己レビュー・独立Opus・Codexで確認する。C2b・S1・親・live・S2の完了を意味しない。
