# Tasks

## 1. 仕様と計画

- [x] 1.1 利用者の初期化範囲・未設定時の2回答をtraceへ記録し、proposalと出典を照合する（REQ-393）。
- [x] 1.2 REQ-393の全5既存Scenarioを保つMODIFIED仕様と、例外時閉鎖・履歴集約・移行を含むdesignを作成し、出典と照合する。
- [x] 1.3 tasksと日誌をそろえ、通常の`pnpm -s verify --change repair-vitest-body-attempt-boundaries --spec-only`とstrict OpenSpec検証の終了0を保存する（REQ-393）。

## 2. 実観測と修理

- [x] 2.1 製品実装前にP35/P37/P41/P27/P28のnative lifecycleとadapter原snapshotを実測し、入力hash・版・登録順・state/calls・status/実exitを保存して厳密assertionの根拠を確定する。identityの無いmetaやソース予想値をoracleにせず、元52件の期待値を保つ（REQ-393）。
- [x] 2.2 kit rootのcreateBodyRunner(Base)・型・context readerを実装し、標準Baseと、runTask/extendTaskContextをprototype methodまたはown function field/arrowで持つBaseの1回委譲・元のthis/値/例外を試験する。reader定義失敗・symbol競合・二重合成も確かめ、導入例とlint・型検査をそろえる（REQ-393）。
- [x] 2.3 bodyをtoken判定・task ledger・token entry・狭いscopeへ修理し、fnのtry外1回実行、終了判定優先、token同一性の入れ子、独立したfinally閉鎖と履歴保持を単体・既存52件で確かめる。token getter/凍結/flag書込み失敗でもmatcher・callback結果を変えず、P43〜P52とstate読取失敗の設定移行後の期待値も保つ（REQ-393）。
- [ ] 2.4 別fixtureでR01〜R04/N01/C01/A04/A07/A08/AF01の記録前後meta・合法await/return・空retryを試験し、2.1の根拠からm1の厳密attempts比較を追加する。同じhost aroundEach設定ごとに恒等版と統合版を比較し、同じcustom Baseの遅延finally中/委譲終了後/次retryのcallback回数・state・metaと全status/実exit、既定isolate・false・複数ファイル・再実行・二重factoryを確かめる（REQ-393）。
- [ ] 2.5 未設定の旧consumerでfn/値/例外を保ち証拠なしとなる独立回帰、設定移行した偽ctx、P07/P08のtask.context、kit tarballの実Vitest consumerと公開d.tsを試験する。既存runner合成・標準wrapper/custom Base委譲の閉じ境界・未設定の影響をガイドとchangesetへ記載し、source aliasなしで導入例を確認する（REQ-393）。

## 3. 統合受入

- [ ] 3.1 全5既存Scenarioと追加Scenarioの要件ID付き試験、52件/native parser・公開API・依存境界を照合し、通常のlocal完了ゲートと品質コマンドを終了0にする。結果と未完事項を日誌へ記録する（REQ-393）。
- [ ] 3.2 最終差分の独立レビュー、同headの必須5 CI・CI完了ゲート・kitの3 OSを満たし、受入証跡を確認する（REQ-393）。

## Workflow follow-up

- 受入条件が揃ってから既存担当が同期・archiveとPR取込みを扱い、必要なarchive後検証を残す。今回の計画では実行しない。
- Issue #376の修理と親#278のreader/gate・CLI接続を分けて報告し、公開・リリースやプレビュー全体の完了を認定しない。
