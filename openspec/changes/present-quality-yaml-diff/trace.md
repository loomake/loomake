# Trace: present-quality-yaml-diff

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 原 B1 の REQ-409 本文・Scenario・台帳と root 二試験 | a470c39d、旧 d649 履歴は保持 | 2026-11-04 |
| 追加設計 7ff1f5fc、refinement-evaluation.md と execution-refinement-audit.json | root D1〜D4 採用、X 計画 67e17f4c | 2026-11-04 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-409 | FR-02/03、Opus RQ-B2 と採否評価、既存 REQ-029 | 機能 | 具体差分または新規全文と、未観測の必須証拠による CI の証拠不足を既存の分割案に添える | 反映済 | specs/req-to-openspec-skill/spec.md |

同じ REQ-409 を原 propose-quality-yaml から移した lineage であり、新しい採番ではない。本文・二 Scenario・台帳行を一字句保持し、REQ-408 全五 Scenario は X に残す。反映済は計画への反映であり、実装・受入ではない。旧七件 RED と B2 160c の全六 Scenario は変更しない。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

追加の意味論 Q・仮定はない。X→Y→B2 は最終受入順であり、親未 main でも許可されたローカル stack を止めない。予算は六 artifact の実数・同期と将来の自身の全差分を区別して証跡に記録する。
