# Tasks

## 1. 仕様

- [x] 1.1 承認記録と出典つき proposal・specs・design・trace を揃え、OpenSpec strict と仕様ゲートを通す

## 2. 保持修正

- [ ] 2.1 元スキーマの検証を維持する安全な保持アダプターと対象スキーマへの適用を実装し、REQ-305 の最上位・入れ子・配列・非同期・入力非変更・プロトタイプの回帰試験を通す
- [ ] 2.2 登録済みアダプターだけを JSON Schema 生成で展開し、既存6種類の JSON 完全一致と未登録の非表現スキーマの失敗を試験する。導出型・遅延ロードの関連試験と changeset・説明を揃える

## 3. 統合確認

- [ ] 3.1 lint・型検査・関連試験・全体の完了ゲートを実行し、要件ごとのテストと独立レビューを確認して最終 head の `pnpm -s verify --change preserve-unknown-schema-fields --done` を通す

## Workflow follow-up

- 必須 CI が成功した head を受け入れ、関連 Issue へ根拠を記録する。未マージの trace スキーマには統合時に同じ保持規則を確認する。
- 受入後に差分仕様を反映して archive する。
