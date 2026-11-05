## 1. 照合関数

- [x] 1.1 外部の信頼値・要約の形式と完全一致の照合を実装し、kit から関数と型を公開する（REQ-443・REQ-444・REQ-445）

## 2. 固定 fixture と試験

- [x] 2.1 要約・自己ハッシュ・リリース記録の fixture を固定し、原本と改変する写しを分けた A16 の試験を追加する（REQ-443・REQ-444・REQ-445）

## 3. 利用案内

- [ ] 3.1 kit README と minor changeset に API と信頼値の取得責任、#69・W5 の未実施範囲を記録する（REQ-443・REQ-444・REQ-445）

## 4. 確認

- [ ] 4.1 全 Requirement の試験、型・lint・仕様の検査を通し、日誌とレビュー依頼を整える（REQ-443・REQ-444・REQ-445）
- [ ] 4.2 `pnpm -s verify --change detect-fixed-summary-tampering --done --scope local` を通す（REQ-443・REQ-444・REQ-445） <!-- loomake:gate=done -->

最終の合格には CI の scope ci 完了ゲート・必須5チェック・kit の3 OSと、独立レビューの受入が別に必要であり、この local タスクの完了だけでは満たさない。
