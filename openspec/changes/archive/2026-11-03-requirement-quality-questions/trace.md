# Trace: requirement-quality-questions

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/requirements/loomake-v0.11.md §6.1 FR-02/03、§10 | main 7d7f69b5 | 2026-11-04 |
| Issue #66 と #121 の Q66-02/03/04/06/07/09 の回答整理 | 親管理役が確認済みの設計入力 | 2026-11-04 |
| openspec/specs/req-to-openspec-skill/spec.md、verify/spec.md | main 7d7f69b5 | 2026-11-04 |
| 品質側 Opus 設計 e8d1395f-995d-44a4-9170-61681bad0b20 と採否評価 | wbs66-quality-refine-20261104 の ignored 証跡 | 2026-11-04 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-406 | FR-02、Opus RQ-A1 と採否評価 | 機能 | 範囲外を除く全要件の五項目を確認し、値・出典または関連 Q を記録する | 反映済 | specs/req-to-openspec-skill/spec.md |
| REQ-407 | FR-03、Opus RQ-A2 と採否評価 | 機能 | 受け入れ条件や判定方法の未定義は関連 REQ つき blocking Q と確認待ちにする | 反映済 | specs/req-to-openspec-skill/spec.md |

台帳の反映済は差分仕様への反映であり、製品の実装・受入を意味しない。REQ-406/407 は全 162 WT の active/main 17,470 文書と GitHub の検索で既存参照 0 件を確認して採番した。Issue 子の REQ-402/403/404 と Git metadata 子の REQ-405 は再利用しない。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

新しい確認事項・仮定はない。Q66 の整理済み回答を再質問しない。既存 A-01 の観測区分を保持し、新たな承認を作らない。YAML の提案・反映や品質モデルの選定は本 change の範囲外である。
