# Trace: verify-v2-quality

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 親change `openspec/changes/verify-v2-c001/`（design 2・3章、design-candidate-a、trace R-C001-03・04・07・08・10） | main b98c2e40 | 2026-10-31 |
| 子change `verify-v2-shape`（REQ-310・313・314）・`verify-v2-scope`（REQ-312） | main b98c2e40 | 2026-10-31 |
| `.loomake/handoff/design-step8b-c001-acceptance-2026-10-31.md`（2章の5/6、S1の位置の節） | 2026-10-31 | 2026-10-31 |
| `.loomake/handoff/workplan-c001-5of6-quality-2026-10-31.md` | 2026-10-31 | 2026-10-31 |
| docs/requirements/loomake-v0.11.md 7.3 | v0.11.3 | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-319 | 親 trace（WBS5章C-001正常/不正/不足、AGENTS DoD、Issue61調査） | 受入 | CLI/APIは正常PASS・不正aborted・不足を区別し、古い結果から合格を作らない | 反映済 | specs/verify/spec.md |

REQ-319は親の差分仕様の本文をそのまま移した。REQ-310（quality.yamlの読取）・313（品質条件の判定）・314（集約）は `verify-v2-shape` の要件で、この子changeはその関数をverifyへつなぐ。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| R-C001-03・04・07・08・10 | REQ-319 | 親traceのとおり | 親traceのとおり | 親traceのとおり | no | 親traceに記録済み（R03・04・07・10 A、R08 B） | 親traceのとおり | 2026-10-30 |
| Q-01 | REQ-319・310・312 | doneのlocalでquality.yamlを読み、品質のcheckを足すか | A: 読むのはあるときだけ（不正はaborted）。品質のcheckはciだけに足す / B: localでも必須にし、品質のcheckを足してpendingに数える | A。localはローカル実施項目の完了だけを返す（REQ-312）。runnerのlocal完了をCIの証跡に依存させない | no | おすすめ（A）で仮実装。管理役の確認待ち | | |
| Q-02 | REQ-319 | 対象SHAが取れないとき（gitでない、コミットがない）をどう扱うか | A: 未照合として不足（1） / B: 対象未確定としてaborted（3） | A。changeと基準は確定しており、欠けているのは証跡の照合だけ。設計表の「不一致は不足」に合わせる | no | おすすめ（A）で仮実装。管理役の確認待ち | | |
| Q-03 | REQ-319 | producerと版をどこから知るか | A: ルートから上へnode_modulesのvitest・jestのpackage.jsonを探す / B: loomake.config.jsonに新しいキーを足す | A。設定を増やさない。どちらもなければ適格性なしで不足。実体hashとmethodの照合はS1の検証計画で行う | no | おすすめ（A）で仮実装。管理役の確認待ち | | |
| Q-04 | REQ-319 | 同じ実行の鮮度を何で判定するか | A: 実行前にレポートを消し、レポートの `startTime` が品質コマンドの開始から終了の間にあること / B: ファイルの更新時刻 | A。更新時刻の分解能はファイルシステムで違い、cp -pで保てる。`startTime` のないレポートは未照合で不足 | no | おすすめ（A）で仮実装。管理役の確認待ち | | |
| Q-05 | REQ-319 | 必須の要件集合をどこから取るか | A: changeの差分仕様のADDED・MODIFIEDのSource（既存の要件ごとのテストと同じ）。実行の前後でhashを比べる / B: S1の承認済み集合を待つ | A。5/6でS1を待たない。実行前に要件を削ったPRの検出はS1の照合で行う（Non-goals） | no | おすすめ（A）で仮実装。管理役の確認待ち | | |
| Q-06 | REQ-319・284 | zodを読まないkitへ、quality.yamlのスキーマをどう渡すか | A: `qualitySchema` を渡し、`loadVerifyQualitySchema()` を用意する。必要なのに渡されなければ使い方の誤り / B: runVerifyを非同期にする | A。runVerifyの同期の契約を保ち、CLIの起動でzodを読まない | no | おすすめ（A）で仮実装。管理役の確認待ち | | |
| Q-07 | REQ-319 | PRを2本に分けたとき、1本目のCIの `verify --done` が未完了のタスクで不合格になるのをどう扱うか | A: 未完了のタスクを残し、1本目はCIの完了ゲートが通らない状態で出す / B: 1本目のtasks.mdには完了した分だけを置き、接続のタスクは2本目で足す / C: 分けずに1本で出す | B。L2・L3のCIは常に `--done` を求める（REQ-343）。ただしREQ-319の判定はarchive（6/6のあと）まで確定しないので、途中の完了印は最終合格を意味しない | no | 作業計画の指示どおり、いまはAで出す。管理役の判断待ち | | |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
