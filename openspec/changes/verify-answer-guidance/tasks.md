# Tasks: verify-answer-guidance

## 1. 正式文書の再構成

- [x] 1.1 採用478設計と公開移管記録を出典にproposal/specs/design/traceを再構成し、REQ-360/361の全7 Scenarioと全AC、18入力の最新差分、Mac成果未取得と試行1/7（版1）の扱いを照合する。
- [x] 1.2 strictと `pnpm -s verify --change verify-answer-guidance --spec-only` の実exit0を確認してから実装へ進む。

## 2. 意味のあるREDと最小実装

- [x] 2.1 旧it/assert/期待値/期限/設定を変えず、新しい `[REQ-360]` と `[REQ-361]` の試験でAC285-1〜6と全7 Scenario・境界を追加し、依存の収集失敗ではない意味のあるREDを確認する。Mac側10件の回収・再現とは扱わない。
- [x] 2.2 coreのsplitLines/fenceMaskをexportし、kitのspec-onlyへ関連Qの対応、回答済みQに関連する確認待ち、コードブロック外の回答済みQ参照の案内を最小実装する。REQ-360のGREEN、doneの既存判定/出力とJSON2.0.0の保持を確認する。
- [x] 2.3 人向けformatV2へ回答/承認の書き方だけを追加し、REQ-361とCLI JSONのGREENを確認する。旧blocking詳細・✔✖!・終了コード・legacy1.0.0・既存の検査とassertを保持する。

## 3. 配布と試行記録

- [x] 3.1 core minor/kit patchのchangeset、試行集計表、1PR4項目worklogとL3計測表を作る。既存の集計があれば保持し、モデル/費用/工程回数/人の作業と返答待ち/未実施理由/指摘/14日観測を区別して、未取得の旧時間・費用を推測で埋めない。

## 4. 正常local完了

- [ ] 4.1 旧試験と設定の保持、全7 Scenarioの成功したID付き試験、lint/typecheck/文書リンクと `pnpm -s verify --change verify-answer-guidance --done --scope local` の実exit0を確認する。全件は管理役と重い実行を調整して一回へまとめ、dirty入力・実終了・最終headとの対応を保存する。 <!-- loomake:gate=done -->

## Workflow follow-up

- 管理役が全差分の別担当確認、新Opus独立レビュー、正常CI doneと必須5チェック・ci:all-osの3 OSを確認する。local完了を最終合格としない。
- PR先頭を「工程分担の試行1/7（版1）」とし、最終マージは別途人へ確認する。追加の実装前人確認、none、段階受入例外は使わない。
- #282製品実装は#285マージ後に進める。通常試行は同時1件とし、マージ後14日の観測は実機会とともに別途記録する。
