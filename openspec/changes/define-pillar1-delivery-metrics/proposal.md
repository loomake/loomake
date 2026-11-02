# Proposal: define-pillar1-delivery-metrics

## Why

[Issue #279](https://github.com/loomake/loomake/issues/279)と[11月計画の柱1](../../../docs/plan-2026-11.md)は、11月7日からLoomakeの利用の有無を同じ5項目で比べるための定義と記録様式を求めている。既存の手書き様式は人の時間と推定の比較を扱うが、5項目の数え方や欠測・観測中の扱いがそろっていない。

## What Changes

- 既存capability `development-decisions` に、柱1の5項目の定義文書を定めるREQ-364と、既存様式への追加節を定めるREQ-365をADDEDで置く。
- 定義・単位・基準時点か観測期間・取得元・記録先・欠測を文書化し、記録あり・不明・非該当・観測中を区別する。M3は14日を観測期間とする。
- FR-50との対応を示し、確認事項の数と判断要求、ゲート停止と試行を区別する。LoomakeなしのM2は非該当とする。
- 既存様式を全文保持して節を追記し、比較の組・規模・Loomake利用の有無と5項目を記録できるようにする。既存の比較方式・固定推定は変更しない。
- 文書を直接読む試験と記録行の正例・負例を追加し、正常local doneと通常L3の受入へ進める。実測値はこのchangeに入れない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `development-decisions`: 計測定義と様式の2 Requirementを追加する。既存REQ-229・230などの本文・Scenarioは変更しない。

## Impact

新規 `docs/metrics/delivery-metrics.md`、`docs/effort/template.md` への追記、`docs/metrics/README.md` のリンク、`tests/development-decisions.test.ts` の追加試験が対象。package・CLI・公開schema・Evidence・FR-50本文・主仕様は変更しないためchangesetは不要である。

採用設計はOpus b8493859のB案。Q279-00〜07はADR 0006の包括承認に従いおすすめで回答し、出典と担当をtraceへ残す。柱4との違いは、具体的なIssue #279を優先する判断として記録する。`--effort`と効率表の生成は#68、保留中のdashboardとmetrics-dataは#273のままにし、私的ログの収集や外部案件の実測は行わない。通常L3の正常ゲート・独立レビュー・必須CIを満たすまで受入とはしない。
