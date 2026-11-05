## 実装

- [x] 1. kit の evidence-range と公開型を追加し、REQ-473 の実 Git・予算・期限・置換参照の試験を通す。
- [x] 2. ReuseRecord の型・例外を出さない validator・既知欄だけの serialize を追加し、REQ-475 の型・秘密・CI識別の境界を試験する。
- [x] 3. record の内部を分離し、runReuse の照合・分岐・状態保護・実際の再検証・保存と REQ-474/475 の全 Scenario を実装する。
- [x] 4. CLI の reuse と5つのオプション・JSON・help、承認済み基準差分・生成ページを追加し、REQ-476 と REQ-323 を試験する。
- [x] 5. kit・trace の公開型 consumer と配布物の試験を追加する。
- [x] 6. 利用者向け説明、3パッケージの patch changeset、worklog と計測表を記録する。
- [x] 7. lint・typecheck・全体試験・生成リファレンス照合を通し、全タスクをチェックした状態で verify --change evidence-only-reuse --done --json --scope local を通す。最終合格は CI の scope ci と必須5チェック・3 OS・独立レビューで判断する。 <!-- loomake:gate=done -->

## 自己レビュー R1 の修正

- [x] 8. 構造照合の証跡を PR の固定記録へ移し、既存証跡を保存する。
- [x] 9. REQ-473 の失敗した本文読取りの共有予算と引数検査を RED→GREEN で修正し、Windows fixtureの作成を効率化する。
- [x] 10. REQ-474/475/476 の一次要約の完了条件と再検証表示を RED→GREEN で修正し、動的な正規表現を静的なパス検査へ置き換える。
- [x] 11. 既存試験・全33 Scenarioを保って品質検査とクリーンなローカル完了ゲートを通し、修正証跡を別名で保存する。 <!-- loomake:gate=done -->
