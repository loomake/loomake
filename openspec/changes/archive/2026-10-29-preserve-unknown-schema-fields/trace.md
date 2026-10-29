# Trace: preserve-unknown-schema-fields

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| core-zod-verify-result の REQ-275、core-quality-yaml-schema の REQ-283、core-parser-schemas の REQ-298、core-quality-report-schema の REQ-301 | main 96138c7 | 2026-10-29 |
| [PR #134](https://github.com/loomake/loomake/pull/134) で統合済みの証拠とリリースレポートの未知フィールド保持（REQ-302） | main f397109 | 2026-10-29 |
| PR #132 の最終レビューで JSON.parse の own property __proto__ が失われることを再現した結果 | 本会話 | 2026-10-29 |
| 利用者の回答「仕様どおり安全に保持する修正を進める（推奨）」 | 本会話。[作業記録の「保持修正の承認」](../../../../docs/worklog/2026-10-29/fix-preserve-unknown-schema-fields.md#保持修正の承認)を参照 | 2026-10-29 |
| [Issue #60](https://github.com/loomake/loomake/issues/60) の「delivery の引き継ぎと未知キーの保持修正」 | 取得時点 | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-307 | REQ-275・REQ-283・REQ-298・REQ-301・REQ-302、PR #132 最終レビュー、本会話の保持修正の承認 | 機能 | 未知の own property を値を変えず保持し、プロトタイプと既存の検証・配布契約を変更しない | 反映済 | specs/core-parsers/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-307 | 未知キー __proto__ が失われる仕様不一致をどう扱うか | A: 仕様どおり安全に保持する修正 / B: キー除外の仕様例外を提案して確認 | A。既存の保持契約を満たす | yes | A。「仕様どおり安全に保持する修正を進める（推奨）」 | 本会話の利用者 | 2026-10-29 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
