# Trace: verify-v2-readers

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 親change `openspec/changes/verify-v2-c001/`（proposal・design.md・design-candidate-a.md・specs・tasks・trace） | main 7359d89 | 2026-10-31 |
| 子change `openspec/changes/verify-v2-shape/`（1本目、PR #192） | main 7359d89 | 2026-10-31 |
| `.loomake/handoff/design-step8-c001-split-2026-10-31.md`（設計メモ。2.2のPR2、6章の採否） | main f26823f 基準 | 2026-10-31 |
| 管理役の指示（PR #197を読む側と書く側の2つに分ける） | 2026-10-31 | 2026-10-31 |
| docs/requirements/loomake-v0.11.md 7.3 | v0.11.3 | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-093 | 現行run「仕様ゲートの確認」、R-C001-05 A | 既存変更 | 仕様ゲートの不合格1と、usage・configのaborted 2・ほかのaborted 3を分け、ブランチを作らずエンジンを呼ばない | 反映済 | specs/run/spec.md |
| REQ-205 | 親 trace、現行run-decision-policy、要件7.3 | 既存変更 | 要判断とabortedで止まり、local完了をDraft PRへ進む条件にする純粋判断 | 反映済 | specs/run-decision-policy/spec.md |

2本目の候補だった12件のうち、2.0.0を読めることだけで満たせるかで、この子changeに移すものを決めた。

| ID | この子changeへ | 理由 |
|---|---|---|
| REQ-205 | 移す | 観測（状態の変更・decision・aborted・local完了・回数・期限）から判断する純粋関数で、2.0.0の結果を読めれば満たせる |
| REQ-093 | 移す | 仕様ゲートの結果が2.0.0のabortedなら2・3で止まる。2.0.0を読めれば満たせる（例外のときの2・3は既存のCLIの経路） |
| REQ-317 | 残す | 「準備と完了確認にv2 APIを使う」「旧verify 1.0.0を自動再利用しない」は書き出しの切替が要る |
| REQ-100 | 残す | 完了ゲートを `verify --done --scope local` と同じ検査にするには、runVerifyのscopeが要る |
| REQ-164 | 残す | 旧Evidence 1を再利用しないことは、1.0.0を受け付け続けるこの子changeと両立しない |
| REQ-318 | 残す | ci-gateがlocal・旧形式を不合格にすることは、書き出しの切替と同時に行う |
| REQ-073 | 残す | 未対応の版の文言を変えると、既存試験の期待値が変わる |
| REQ-040・041・311・315 | 残す | verifyとtrace recordの書き出しの切替 |
| REQ-066・042 | 残す | 親（REQ-066）と `verify-v2-wiring`（REQ-042）で扱う |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| R-C001-01〜10 | 親の全Requirement | 親traceのR-C001-01〜10 | 親traceのとおり | 親traceのとおり | no | 親traceに記録済み（R05・06・07 A、R08 B、ほかA） | 親traceのとおり | 2026-10-30 |
| S8-04 | 全Requirement | 2本目のPRが200KiBを超えたとき、どう分けるか | A: 読む側の対応と書く側の切り替えの2つ / B: runnerの振る舞い試験だけを分ける | A。Bでは200KiBを下回らない | no | A（管理役承認（2026-10-31）） | 管理役（Claude、ADR 0006） | 2026-10-31 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-205 | 完了ゲートの結果が2.0.0のとき、scope:localで終了コード0の結果だけをローカル完了とみなす。ciのPASSはローカル完了とみなさない | 要件定義7.3でlocalの0がDraft PRへ進む条件。ciの合否はCIの最終確認で使う | | | |
