## 実装

- [x] 1. kit の evidence-range と公開型を追加し、REQ-473 の実 Git・予算・期限・置換参照の試験を通す。
- [x] 2. ReuseRecord の型・例外を出さない validator・既知欄だけの serialize を追加し、REQ-475 の型・秘密・CI識別の境界を試験する。
- [x] 3. record の内部を分離し、runReuse の照合・分岐・状態保護・実際の再検証・保存と REQ-474/475 の全 Scenario を実装する。
- [x] 4. CLI の reuse と5つのオプション・JSON・help、承認済み基準差分・生成ページを追加し、REQ-476 と REQ-323 を試験する。
- [ ] 5. kit・trace の公開型 consumer と配布物の試験を追加する。
- [ ] 6. 利用者向け説明、3パッケージの patch changeset、worklog と計測表を記録する。
- [ ] 7. lint・typecheck・全体試験・生成リファレンス照合を通し、全タスクをチェックした状態で verify --change evidence-only-reuse --done --json --scope local を通す。最終合格は CI の scope ci と必須5チェック・3 OS・独立レビューで判断する。 <!-- loomake:gate=done -->
