# Trace: verify-v2-evidence

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 親change `openspec/changes/verify-v2-c001/` | main d1458b1 | 2026-10-31 |
| 子change `verify-v2-wiring`（2b-1/6、PR #197） | main d1458b1 | 2026-10-31 |
| `.loomake/handoff/design-step8-c001-split-2026-10-31.md`（設計メモ2.2） | main f26823f 基準 | 2026-10-31 |
| 管理役の決定（2b-2/6の範囲、REQ-324の基準の変え方） | 2026-10-31 | 2026-10-31 |
| docs/requirements/loomake-v0.11.md 7.3 | v0.11.3 | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-073 | 親 trace、現行trace-report「使った証拠の記載」 | 既存変更 | Evidence 1/verify 1.0.0とEvidence 2/verify 2.0.0を受け付け、未対応の版・版の混在・状態別の必須欄の欠けはファイルと箇所を示して終了コード2 | 反映済 | specs/trace-report/spec.md |
| REQ-324 | 親 trace、現行reference-docs、R-C001-05 A | 既存変更 | help/usage等の不変MUSTを共通定義への集約単独に限り、改版の基準の差分は承認して別に記録する | 反映済 | specs/reference-docs/spec.md |

REQ-324は、親のMODIFIED（R-C001-05 Aで承認済み）をそのまま移し、改版での基準の差分のScenarioを足した。今回の具体差分はS8-07で承認された1行（3例）だけである。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| R-C001-01〜10 | 親の全Requirement | 親traceのR-C001-01〜10 | 親traceのとおり | 親traceのとおり | no | 親traceに記録済み（R05・06・07 A、R08 B、ほかA） | 親traceのとおり | 2026-10-30 |
| S8-05 | 全Requirement | 書く側のPRをどう分けるか | 親traceと `verify-v2-wiring` のtraceのとおり | A | no | A（2b-1・2b-2・2c・6/6）。生成物は大きさから除く | 管理役（Claude Fable 5.1） | 2026-10-31 |
| S8-07 | REQ-324・040 | `verify --skip-commands` のhelpの説明（「すでにあるテストのレポートを読む」）が、REQ-040の動き（レポートを読まずに品質コマンドの項目を不足にし、終了コード1）と違う。基準mainの全文と比べる試験をどう扱うか | A: 原本を残し、承認した差分を別ファイルに記録して試験で当てる / B: 原本を書き換える / C: helpを変えない | A。原本を書き換えずに、変えた行と承認元を追える | no | A（管理役採用（2026-10-31））。管理役の依頼（基準の該当行をこのchangeのMODIFIEDか基準の更新の手順で正規に変える）に沿う。対象は `verify --help`・`verify -h`・`verify --change --help` の該当1行 | 管理役（Claude Fable 5.1） | 2026-10-31 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

Evidence 2で `run.status` がabortedの記録に `scope`・`checks`・`summary`・`decision` を求めないのは、REQ-308（2.0.0のabortedはこれらを持たない）に従う。
