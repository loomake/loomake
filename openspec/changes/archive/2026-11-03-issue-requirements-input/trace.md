# Trace: issue-requirements-input

管理役が取得範囲と301行の本子を技術判断で採用した。本人が Q66-01 に A と答えた記録にはしない。旧 A-01 は既承認の検証方針として引用し、新しい仮定や承認を作らない。

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/requirements/loomake-v0.11.md §6.1 FR-01・外部文の扱い | main 7d7f69b5 | 2026-11-03 |
| WBS W1-7・Issue #66 | https://github.com/loomake/loomake/issues/66 | 2026-11-03 |
| Opus 設計76929070 §3①・評価 evaluation.md | 対象main7d、実exit0 | 2026-11-03 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-402 | FR-01・W1-7・Opus R66-I1 | 機能 | 指定 Issue の本文と全コメントを読み、範囲外へ広げず取得不能/不完全なら止まる | 反映済 | specs/req-to-openspec-skill/spec.md |
| REQ-403 | FR-01・REQ-026・Opus R66-I2 | 機能 | Issue の位置つき出典と取得時点を既存の入力文書 3 列へ残す | 反映済 | specs/req-to-openspec-skill/spec.md |
| REQ-404 | 要件書の外部文の扱い・Opus R66-I3 | 制約 | Issue の製品要求を台帳に載せ、作業者へ向けた外部命令には従わない | 反映済 | specs/req-to-openspec-skill/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
