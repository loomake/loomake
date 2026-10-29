# Proposal: verify-v2-c001

## Why

現行 verify は `ok/results` の 1.0.0 を返し、quality.yaml を判定へ接続していない。要件定義7.3と固定WBS 5章のC-001に従い、最小入力・限定した条件判定・実行エラーを区別する入口を、公開側と既存利用側を同じchangeで移行して準備する。

## What Changes

- **BREAKING** verify JSON を `schemaVersion: 2.0.0` の実行状態・scope・4値判定へ移す。aborted と終了コード0〜3を契約試験にし、旧1.0.0は履歴閲覧に限って残す。旧JSON Schemaの追加公開案はR-C001-09で判断する。
- quality.yaml `version: 2` を読み、対象外の理由・確認者、比較条件、証拠不足、集約を純関数で判定する。正常PASSに必要な最小実証跡の取得範囲はR-C001-03で確定し、未取得・未照合の証拠をPASSにしない。
- kit/CLI、ci-gate、runner、trace record/report、埋め込みJSON Schema、公開型・配布物・移行説明を一体で追従させる。
- quality.yamlの初期準備はci.test_reportの1必須項目を持つ具体候補と、切替当日の全open PRの再検証をR07で判断する。31副特性のinit生成全体（#66）は含めない。
- bare verifyの契約衝突（R-C001-01）、`summary.evaluated` の意味（R-C001-02）、最小実証跡の範囲（R-C001-03）と信頼する判定器の構築（04）を分け、互換差分（05）・ローカルDoD（06）・quality配置（07）・ゲート/scope別warnとskip-commandsの非互換移行（08）・旧JSON Schema公開（09）・spec-only計数（10）も未回答のブロッキング質問としてレビューへ出す。推奨案を承認済みとは扱わない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `core-parsers`: verify 2.0.0と履歴1.0.0、埋め込み証拠とレポートの版を区別する。
- `verify`: quality読取、scope、aborted、終了コードとJSON出力を定める。
- `verification-policy`: 限定した条件判定・集約と件数を定める。
- `trace-record`: v2結果を新しい証拠形式で記録する。
- `trace-report`: 新旧の閲覧を維持し、旧形式・localを最終合格に使わない。
- `run-decision-policy`: v2のdecision・実行状態・local完了を読んで停止と継続を決める。
- `monorepo`: ci-gateを同時追従させ、公開契約と移行を配布物で確認する。

## Impact

対象はcore・kit・trace・runner・CLIと `scripts/ci-gate.mjs`、関連fixture、配布smoke、互換性文書。verifyを埋め込むEvidenceは2へ上げ、旧Evidence 1の閲覧を保持する。Report 2とRunSummaryの外形は維持し、既存フィールドへ投影する。core・kit・trace・CLIの公開契約の破壊的変更にはminor、内部追従だけのrunnerにはpatchのchangesetを計画し、形式版とは分ける。

本PRは計画のみ。branch作成時の基準はmain `f397109`。その後、#60の未知キー保持修正（REQ-307）はPR #140と仕様反映・archiveのPR #141で受け入れられ、#60はclose済みで、現在確認したmain `f4e3edb`に含まれる。実装を止めているのは未回答のR-C001-01〜10と仕様ゲートであり、#60を現在の未受入依存には数えない。既存REQ-305・307は意味を引き継いでMODIFIEDとし、REQ-306や使用済みIDを別の要件へ再割当しない。新しい要件IDは今回割り当てない。

## 全Aの場合の未承認候補

[design-candidate-a.md](design-candidate-a.md)に、確認事項10件がすべてAの場合だけのsource/metric・検証計画・最小適格性・信頼する検証器の準備・正常自己ゲート・受入例を整理した。S1準備とprivate handoffを含むR-C001-04 Aの追加具体案は未承認であり、7 capabilityの差分仕様には採否前の候補と既存仕様との整合修正を記した。Bがあれば該当部分を再設計し、この全A案を無条件に実装しない。

## C-003との境界

C-001は最小quality入力、条件と集約、abortedと終了コード、`--done --json` の骨組みまで。C-001へ先行する最小実証跡の範囲はR-C001-03の回答で決める。全providerの接続、完全なhost隔離、広いCI成果物取得・再利用連鎖、最小接続以外のpartial取得経路と全禁止フィールドの網羅試験はC-003へ残す。A案の最小接続に必要なproducer/version・実効手順・対象版/SHA/spec・環境・鮮度・信頼する基準との照合と実施確認はC-001に含める候補とし、C-003へ先送りしたまま正常PASSにしない。2.0.0の構造にはpartialも定義し、C-001の限定実装を契約全体の完了や証拠再利用の許可とは扱わない。#61・63・64全体をcloseしない。
