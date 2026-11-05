# Tasks

## 1. 仕様と前提
- [x] 1.1 P1の要約拡張と#65の共通秘密置換のmain受入、採用した設計・確認事項・全Scenarioを照合し、strictと仕様ゲートを実終了0にする。

## 2. receiptの型・保存
- [x] 2.1 coreへ追加型・遅延構造スキーマ・schema/summaryの生成/配布を追加し、既存12Schema・入口の遅延読込み・own keyと未知欄を保つ（REQ-470）。
- [x] 2.2 traceの同期検証・整形とサイズ再検証・共有maskで変わる入力の拒否・非上書き原子的追加を実装し、実retrievedAt由来の名前と衝突を確認する（REQ-470）。

## 3. 照合と参照解決
- [x] 3.1 kitへ入力不変の7項目の純粋照合を追加し、strict UTF8・CI3箇所・checkout・bodyとZIP・byte view・外部anchorの境界を検証する（REQ-471）。
- [x] 3.2 traceの明示policy/now付きresolverを追加し、本体別結果・優先順位・不正候補・矛盾・重複全path・期限/権限未確認・入力予算と安全な診断を確認する（REQ-471）。

## 4. 互換と案内
- [x] 4.1 全ScenarioのREQ名付き試験、公開型consumer、配布物、既存Evidence1/2・12Schema・同期report/serialize・runner再利用・固定要約不変を既存assertを弱めず確認する（REQ-470・471）。
- [ ] 4.2 利用者文書・非破壊追加のpatch changeset・branch日誌に、索引の一致と実取得/真正性/品質合格の区別、親#69の残作業を記録する。

## 5. ローカルの完了
- [ ] 5.1 通常の `pnpm -s verify --change index-evidence-body-references --done --scope local` を実行し、全tasks・対応試験と全検査PASS・実終了0を確認する。<!-- loomake:gate=done -->

最終受入は管理役が、非起草Codexの同一依頼による自己レビュー、独立Opus、CI scope ci完了、必須5チェックと変更packageの通常3 OS成功を確認する。未実装の親受入や実取得を、本changeの試験で済ませたとはしない。
