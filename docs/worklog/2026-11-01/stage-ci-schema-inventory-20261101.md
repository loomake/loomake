## CI の schema2file 採集を確認する基盤

1. `split-slow-ci-checks` の task2.8として、測定metadataの旧17fileを保ってschema2fileを必須対象へ加え、各欠落の負例と接頭辞前の静的inventoryを追加した。受入済み2.2・2.3・2.5・2.6を反映し、印は6/21とした。対応は Issue #241・#240、PR は管理役が起票する。
2. 変更前は包含不足で4件失敗・168件成功し、実装後は関連172件が成功、失敗・skipは0だった。仕様ゲート・strict・lint・typecheckが成功し、仕様ゲート内のbuildも成功した。親の完了ゲートと全体試験は未実施。
3. Q-61・Q-62の採用済みAを再利用した。元schema2fileの全文・15trial・子script・既存の設定とregistryを保持し、静的照合を実schema試験の再実行や最新3OS測定の代わりにしない。
4. 管理役がPRを起票し、同headの必須CI・3OS・独立自己レビュー・Opus最終を確認する。task2.8は統合枝への受入まで未チェックとし、実registry・OS割当・R4・親DoDは未完了のまま残した。
