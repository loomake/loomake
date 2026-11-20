# Trace: effort-summary

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| Issue #68 と要件定義 FR-50・7.8、docs/effort/（C-001・様式） | main 74c2e4e3 | 2026-11-06 |
| Opus 設計 536f301e-d036-48d4-b48d-cea30184a5de | claude-opus-5-5、設計工程、§1〜§6 | 2026-11-06 |
| 管理役の採用判断・ADR 0006・ADR 0002 | 本会話の PR2b 依頼、Q-P2-01〜06 = A | 2026-11-20 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-467 | FR-50、Opus§2 群 1〜3、§1 | 機能 | 手書きの効率記録と Effort 1 を共有予算で読み、原本を変えず、出典と欠測を保つ | 反映済 | specs/effort-summary/spec.md |
| REQ-468 | FR-50・7.8、Opus§2 群 4〜5 | 機能 | 9 列の表を、欠測を代入せず決定的に集計・整形する | 反映済 | specs/effort-summary/spec.md |
| REQ-171 | 既存 bounded-input、Opus§4 | 変更 | 予算を共有したまま、置換 decode をしない bytes の読取りを持つ | 反映済 | specs/bounded-input/spec.md |

## 確認事項

回答者は管理役による ADR 0006 のおすすめ採用であり、新たな利用者個別承認ではない。出典は Opus§3 と PR #462 の trace.md。

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-P2-04 | REQ-468 | 人力実測ありの比較をどうするか | A:別行で削減率不明 / B:様式に欄追加 | A。実測値の欄がない | no | A。様式の変更は範囲外で Issue に記録。出典:Opus§3、管理役採用、ADR0006 | 管理役Codex | 2026-11-06 |
| Q-P2-05 | REQ-171 | 共有予算で bytes を読む方法 | A:kit に専用 reader / B:trace で管理 | A。安全確認を共用する | no | A。出典:Opus§3、管理役採用、ADR0006 | 管理役Codex | 2026-11-06 |
| Q-P2-06 | REQ-467 | 手書き費用の書式をどうするか | A:CLI の文法だけ / B:自由記述から推定 | A。区分を推測しない | no | A。出典:Opus§3、管理役採用、ADR0006 | 管理役Codex | 2026-11-06 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-467 | `effort-record-hardening` の archive 後も REQ-466 と `effortProblem` の契約は変わらない。この change は REQ-466 を変更しない | PR2a は main にマージ済みで、この change が触るのは REQ-467・468・171 だけ | yes | 管理役（本会話の依頼） | 2026-11-20 |
| A-02 | REQ-467 | REQ-171 の変更は bounded-input の既存本文に 1 文と 1 Scenario を足すだけで、archive 同期の `effort-record` の変更と衝突しない | 別 capability のため | yes | 管理役（本会話の依頼） | 2026-11-20 |
