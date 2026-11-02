## 1. 仕様と実装前の確認
- [x] 1.1 REQ-023の既存全文と採用した1行、Q-286-02〜05、独立レビュー不変条件、300行見積り、既存否定assertとの一致0を確認し、strictとspec-onlyを通す。

## 2. 回帰と最小実装
- [x] 2.1 既存の全assert・期待値・期限・skip・設定を変えず、REQ-023の新試験で意味のあるREDを確認する。
- [x] 2.2 成功時のstdout1行を追加し、関連init/doctor試験のGREENと既存の配置・commands・exitの保持を確認する。

## 3. 記録と完了
- [x] 3.1 kit patch changesetをcommitし、日別worklogへ判断と結果を短く追記する。
- [ ] 3.2 通常のlocal完了ゲートでlint・型・全試験・要件対応と全taskを確認する。最終受入は別担当確認・新独立Opus・必須CI・3OSと直前head照合で行う。 <!-- loomake:gate=done -->
