# Trace

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-148 | docs/wbs/baseline-v1.4.md 0章 J04・W1-4、docs/architecture.md 0.2・3、既存 verification-policy の同要件 | 機能 | 合意判定を kit へ移し、core の公開 API から外す。既存の純粋な判定を保つ | 反映済 | specs/verification-policy/spec.md |
| REQ-149 | docs/wbs/baseline-v1.4.md 0章 J04・W1-4、docs/architecture.md 0.2・3、既存 verification-policy の同要件 | 機能 | テスト対応判定を kit へ移し、core の公開 API から外す。重複排除・順序・不足・非破壊の判定を保つ | 反映済 | specs/verification-policy/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

J04 の配置、公開 API 削除、互換期間なしは既存の決定であり、追加の判断はない。W1-1・W1-3 に依存する新しい品質判定は本 change に含めない。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
