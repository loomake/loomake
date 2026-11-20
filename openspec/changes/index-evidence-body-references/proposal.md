# Proposal

## Why

固定された判定の要約から、取得済みの実行記録の本体を辿る小さな索引がまだない。Issue #69 と要件定義7.9、採用済みOpus補足設計に従い、要約を書き換えずに参照と照合結果を追加する。

## What Changes

- REQ-470：indexVersion 1のreceiptを、1件1ファイルで原子的に追加する。要約・本体・CI・ZIP・実期限・取得時刻を分け、同名を上書きしない。
- REQ-471：固定要約のraw bytesとreceiptを照合し、本体ごとの参照解決・保持期間・未確認の閲覧権限を返す。壊れた候補を無視して成功へ戻らない。
- P1の要約拡張と#65の共通秘密置換がmainへ入るまで実装を止める。既存12 Schema、Evidence 1/2、同期API、runnerの再利用、旧試験を保持する。

## Capabilities

### New Capabilities

- `evidence-body-index`：固定要約に結び付く本体参照receiptの追加と、保存済み索引による参照解決。

### Modified Capabilities

なし。既存の本体照合・期限判定・原子的公開を呼び出し、既存のRequirementは変えない。

## Impact

coreの追加型・遅延構造スキーマ・独立したJSON Schema、kitの純粋な照合API、traceのreceipt追加と索引読取り、型consumerと境界試験、利用案内とchangeset。実行時依存を増やさず、coreのZod遅延読込みを保つ。

## Non-goals

- 同じW1の別通常PR：REQ-472の限定手動workflow・bundle/fetch・実取得による運用受入、REQ-464/465のrelease形式・失敗試行、旧raw記録の整理。全義務をparent-handoff.mdへ残す。
- W2の必須gate自動化、W5の公開・リリース生成・承認・長期保存先への自動転送、W1-14の履歴切出し。
- receiptの自己ハッシュを外部の信頼anchorにすること、全memberの閲覧権限・真正性・現在の取得・品質合格を、索引の一致だけから導くこと。

## 品質の定義と保持

既存のPQ-900（ci.test_report、required_subjects_with_failed_tests、target == 0、min_samples 1）を保ち、各RequirementとScenarioをREQ名付き試験で確認する。新しい目標値・品質モデル・root quality.yamlの変更は作らない。利用状況は要件定義3章、受入と照合の意味は7.9、秘密情報保護はNFR-09を出典とする。実取得の運用証拠を純粋関数の試験で代用しない。
