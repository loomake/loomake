# Trace: propose-quality-yaml

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/requirements/loomake-v0.11.md FR-02/03、§7.1 と既存 req-to-openspec-skill | main 7d7f69b5＋A 04d07088 | 2026-11-04 |
| 追加 Opus 設計 7ff1f5fc と refinement-evaluation.md、execution-refinement-audit.json | wbs66-b1-split-design-20261104、root 採用済み | 2026-11-04 |
| 原 B1 の計画・全七件 RED と d649 の日誌 | a470c39d・d649b356、保存のみ | 2026-11-04 |
| Issue #66 と #121 の整理済み回答、旧品質設計 e8d1395f の採否評価 | 同一要件の出典を保持 | 2026-11-04 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-408 | §7.1、原 RQ-B1、追加設計 X と root 採用 | 機能 | 根拠ある UQ/PQ 案と不足 Q、target・context を保ち、既存一般分割合意でも案を確認する | 反映済 | specs/req-to-openspec-skill/spec.md |

同一 REQ-408 の分割再配分であり、新規の採番ではない。原 B1 の REQ-409 と二 Scenario は Y の present-quality-yaml-diff へ同一 ID で移管する。X の Scenario 2〜5 は原 a470 から一字句保持し、本文と Scenario 1 の一般合意だけを追加した。反映済は仕様への反映であり実装・受入ではない。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

追加の意味論 Q・仮定承認はない。旧 5d4a の不成立判断は誤根拠として不採用、7ff の分割可能性を採用した。X→Y→B2 は最終受入順であり、許可済みローカル stack の先行を禁止しない。B2 の計画・全六 Scenario、旧 B1 の履歴・RED・日誌を保持する。
