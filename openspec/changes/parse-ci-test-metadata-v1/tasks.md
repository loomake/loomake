# Tasks

## 1. 仕様ゲート
- [x] 1.1 Q-C003-02の本人回答を記録し、strict/spec-only終了0を確認する（REQ-391）。

## 2. 実装と試験
- [x] 2.1 metadata変換・公開型/exports・全ScenarioのID付き試験・公開consumer・core patch changesetを追加し、旧API/TEST/PINを保持する。関連parser試験と公開型検査の終了0を確認する（REQ-391）。

## 3. 完了ゲート
- [ ] 3.1 通常localdoneの全品質・実JSON・実exit0を確認する（REQ-391）。 <!-- loomake:gate=done -->

最終受入はCI完了ゲート・必須5チェック・3 OS・独立Opus重大0で別に確認する。親とbundleは未完。
