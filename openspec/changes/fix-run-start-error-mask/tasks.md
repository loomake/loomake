# Tasks

## 1. 仕様と不変条件

- [x] 1.1 REQ-154本文・旧2Scenario・Sourceの原文一致と追加1Scenarioを確認し、strictとspec-onlyの実exit 0を確認する。

## 2. 追加回帰と修理

- [x] 2.1 同じCLI入口のlock/prepare×合成秘密/通常診断4ケースを追加し、既定期限のまま負例2件のREDと正例2件の成功を保存する（REQ-154・199・137）。
- [ ] 2.2 run.tsの2catchだけで既存maskSecretsを使い、4ケースと既存mask/診断/run/期限/CLI試験の成功、旧source/試験/設定不変を確認する。runner patch changesetと判断結果を同梱する（REQ-154・199・137・192）。

## 3. 完了ゲート

- [ ] 3.1 通常localdoneを全品質込みで実行し、実tasks入力・JSON・exitを保存する。成功後だけ完了を確定する（REQ-154）。 <!-- loomake:gate=done -->

## Workflow follow-up

- 新L3 PR作成は本数条件で保留。CI・別担当自己/独立最終レビュー・merge/archiveは後続。ローカル完了を#65/C003や親の完成とは呼ばない。
