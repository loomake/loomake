# Trace: split-trace-report-table-requirement

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
この change は Requirement の本文を 500 文字以内にするために分けるもので、振る舞いは変えない。
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| PR #6（rename-acceptance-to-release の archive）の確認事項と、レビュー 5641828622 の経緯 | - | 2026-10-25 |
| docs/requirements/trace-v0.1.md（trace の要件定義書） | v0.1 | 2026-10-23 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-070 | trace 要件定義書 v0.1 §3.2 TRC-RPT-01 | 機能 | `loomake trace report --change <id>` で、要件ごとに出典・対応する Requirement・テスト・最後の検査結果を並べた表を出力すること。PR #6 の確認事項で、Requirement の本文を 500 文字以内にするため、change の探し方と change-id の検査を REQ-213 に分け、残りを「要件ごとの結果の表の出力」とする | 反映済 | specs/trace-report/spec.md |
| REQ-213 | PR #6 の確認事項、レビュー 5641828622 | 機能 | `loomake trace report` は change を進行中の change から探し、なければ archive から探すこと。change-id が OpenSpec の change 名の形でないときと `archive` のときは、使い方の誤りとして終了コード 2 を返すこと（REQ-070 の本文から分けたもの。振る舞いは変えない） | 反映済 | specs/trace-report/spec.md |

## 確認事項

<!-- 回答 欄が空で ブロッキング = yes の行があると、verify の仕様ゲートは失敗する。回答を書いたら、回答者（名前の代わりに役割でもよい）と回答日（YYYY-MM-DD）も書く -->

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

## 仮定

<!-- 承認 欄が空の仮定は verify で警告になる（失敗にはしない）。承認したら、承認者（名前の代わりに役割でもよい）と承認日（YYYY-MM-DD）も書く -->

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
