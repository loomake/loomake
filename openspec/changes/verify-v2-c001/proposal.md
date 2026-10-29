# Proposal: verify-v2-c001

## Why

現行 verify は `ok/results` の 1.0.0 を返し、quality.yaml を判定へ接続していない。要件定義7.3と固定WBS 5章のC-001に従い、最小入力・限定した条件判定・実行エラーを区別する入口を、公開側と既存利用側を同じchangeで移行して準備する。

## What Changes

- **BREAKING** verify JSON を `schemaVersion: 2.0.0` の実行状態・scope・4値判定へ移す。aborted と終了コード0〜3を契約試験にし、旧1.0.0は履歴閲覧に限って残す。
- quality.yaml `version: 2` を読み、対象外の理由・確認者、比較条件、証拠不足、集約を純関数で判定する。実レポート取得・適格性照合を接続するC-003までは、取得していない証拠をPASSにしない。
- kit/CLI、ci-gate、runner、trace record/report、埋め込みJSON Schema、公開型・配布物・移行説明を一体で追従させる。
- quality.yamlの初期準備は最小例の手動作成と移行案内を計画する。31副特性のinit生成全体（#66）は含めない。
- bare verifyの契約衝突（R-C001-01）と `summary.evaluated` の意味（R-C001-02）を未回答のブロッキング質問としてレビューへ出す。推奨案を承認済みとは扱わない。

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

本PRは計画のみ。#60の未知キー保持修正（REQ-307）の受入、質問の回答反映、仕様ゲート成功と新たな実装指示までは着手しない。REQ-305・306の共有型と集約を再利用し、REQ-308以降を使う。

## C-003との境界

C-001は最小quality入力、条件と集約、abortedと終了コード、`--done --json` の骨組みまで。実テストレポート・source/metricの接続、対象版・SHA・環境・鮮度の適格性、partial発生経路と全禁止フィールドの網羅試験はC-003へ残す。2.0.0の構造にはpartialも定義し、C-001の限定実装を契約全体の完了や証拠再利用の許可とは扱わない。#61・63・64全体をcloseしない。
