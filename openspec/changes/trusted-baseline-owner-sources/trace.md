# Trace: trusted-baseline-owner-sources

## 入力と出典

[Issue #310](https://github.com/loomake/loomake/issues/310)、C1 archiveのQ-S1-14、Opus修正版設計47168de9（2026-11-02）。[REQ-388予約](https://github.com/loomake/loomake/issues/310#issuecomment-6567741885)。C2b同期・archiveのmain受入が実装前の必須前提で、task1.2で照合する。

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-388 | #310のSource/capability対応、採用済Q-S1-14、Opus修正版§1 | 機能 | 原Source所有を各行に保ち、例外はC001の固定値・331タグ試験に照合する。主体/trace/Git/新実行は未検証 | 反映済 | specs/trusted-baseline/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-C3A-01 | REQ-388 | 既決Q-S1-14の例外をどこから選ぶか | コード固定表 / 記録の追加欄やadoption | 前者。既存記録とPINを保持する | yes | 前者。C001専用入口で深く凍結した定数を選び、表を引数にしない。既決Q-S1-14の実装方式で承認範囲は増やさない | 管理役 Codex | 2026-11-02 |
| Q-C3A-02 | REQ-388 | capabilityはどのpathと比べるか | 既存ownerBlockの論理path / archiveを含む物理path | 前者。既存の同change正規化を再利用 | yes | 前者。archiveを同じchangeの論理pathへ戻す。例外はmain-unchangedの1件だけに固定する | 管理役 Codex | 2026-11-02 |
| Q-C3A-03 | REQ-388 | 今回の受入はどこまでか | 本文とSourceの私的照合 / #310全体 | 前者。未決や未実施を完了にしない | yes | 前者。#310の所有対応の項目全体には印を付けず、API/採否/来歴/新実行・共有・同句排他・S1/親の全受入は残す | 管理役 Codex | 2026-11-02 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

親の未回答は同句の置換と未対応の共存、およびrow間/active/archiveの所有共有である。今回の照合はそれらを禁止・統合せず、採否にも依存しない。REQ-379/380の予約と#310の全残条件を保持する。全6 Scenarioはtasks2.1〜2.3のT-C3A-01〜06へ順に対応する。
