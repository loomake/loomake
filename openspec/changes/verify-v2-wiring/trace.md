# Trace: verify-v2-wiring

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 親change `openspec/changes/verify-v2-c001/` | main c9e6a14 | 2026-10-31 |
| 子change `verify-v2-shape`（1/6、PR #192）・`verify-v2-readers`（2a/6、PR #198） | main c9e6a14 | 2026-10-31 |
| `.loomake/handoff/design-step8-c001-split-2026-10-31.md`（設計メモ2.2） | main f26823f 基準 | 2026-10-31 |
| 管理役の決定（2b-1/6・2b-2/6・2c/6への分割、承認事項） | 2026-10-31 | 2026-10-31 |
| docs/requirements/loomake-v0.11.md 7.3 | v0.11.3 | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-040 | 親 trace、現行verify「JSON 出力」、要件7.3 | 既存変更 | 2.0.0でも要件ごとの成功テストファイル一覧をcoverageに出し、abortedとskipでは出さない | 反映済 | specs/verify/spec.md |
| REQ-041 | 親 trace、現行verify「終了コード」、WBS J02 | 既存変更 | 使い方の誤り2を保ち、REQ-311の共通判定をAPIとCLIで使う | 反映済 | specs/verify/spec.md |
| REQ-042 | 現行verify「change の省略」、R-C001-01 A | 既存 | changeなしのverifyはcommandsだけを実行する。2.0.0ではchange:null・local・verdictなしで返す | 既存仕様で充足 | openspec/specs/verify/spec.md（本文は変えない） |
| REQ-100 | 親 trace、現行run「完了ゲートと直し」 | 既存変更 | runの完了ゲートを明示localにし、既存5 Scenarioを保つ | 反映済 | specs/run/spec.md |
| REQ-311 | 親 trace、要件7.3の終了コードの表 | 機能 | APIとCLIで共通の0〜3、JSONだけの標準出力、標準エラーの診断、非対話 | 反映済 | specs/verify/spec.md |
| REQ-315 | 親 trace、要件7.3、WBS J03 | 機能 | Evidence 2で2.0.0を保存し、旧1.0.0を自動で再利用しない | 反映済 | specs/trace-record/spec.md |

REQ-315の旧Evidence 1を再利用しないこと（REQ-164）と、Evidenceの現行の名前の切替は、2c/6と2b-2/6で行う。

管理役承認（2026-10-31）の逸脱：(1) REQ-066は、MODIFIEDのScenarioが `trace record --scope` のフラグを使うため親に残す。(2) REQ-073は子changeで扱い、2b-2/6に置く（Evidenceの現行の名前を2にすると、reportの未対応の版の判定と文言が変わるため）。(3) root `quality.yaml` は置くだけで（2b-2/6）、verifyへの接続は6/6で行う。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| R-C001-01〜10 | 親の全Requirement | 親traceのR-C001-01〜10 | 親traceのとおり | 親traceのとおり | no | 親traceに記録済み（R05・06・07 A、R08 B、ほかA） | 親traceのとおり | 2026-10-30 |
| S8-05 | 全Requirement | 書く側のPRが200KiBを超えたとき、どう分けるか | A: verifyの書き出しの切替（2b-1）、Evidenceの現行名とreport（2b-2）、旧形式の不合格（2c）に分け、受入を6/6にする / B: 1つのまま | A。Bは上限を超える | no | A（管理役承認（2026-10-31））。生成したJSON Schemaとschema-historyは大きさから除く | 管理役（Claude Fable 5.1） | 2026-10-31 |
| S8-06 | REQ-050 | `--skip-commands` でレポートを解析しなくなったとき、性能の試験の範囲が狭まってよいか | A: 狭めてよい（6/6で足す） / B: 2bの中で、解析を含む処理量の確認を残す | B | no | B（管理役。Aは承認しない） | 管理役（Claude Fable 5.1） | 2026-10-31 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-311 | 1.0.0の検査名（「change の存在」「command: test」など）を、2.0.0のcheckのidにそのまま使う | 7.3にidの定めがない | 管理役承認（2026-10-31） | 管理役（Claude Fable 5.1） | 2026-10-31 |
| A-02 | REQ-311 | 1.0.0でwarnだった項目（未承認の仮定、確認待ちの要件、未知の設定キー、openspecValidate:autoでのCLI不在）は、REQ-036〜039を実装するまで案内つきのPASSにする | 終了コードを保つ | 管理役承認（2026-10-31） | 管理役（Claude Fable 5.1） | 2026-10-31 |
| A-03 | REQ-040・311 | 品質コマンドが時間・出力の上限や中断で止まったときは、その項目を不足にし、run.errorsにruntimeを足してpartialにする | design-candidate-a.mdの受入例 | 管理役承認（2026-10-31） | 管理役（Claude Fable 5.1） | 2026-10-31 |
| A-04 | REQ-311・041 | `runVerify` は使い方と設定の誤りでこれまでどおりUsageErrorを投げ、CLIとtrace recordは `verifyAbortedResult` でabortedの結果に変える | REQ-041の例外の契約を保つ | 管理役承認（2026-10-31） | 管理役（Claude Fable 5.1） | 2026-10-31 |
