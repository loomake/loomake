# 2026-10-29 の作業記録（feat/core-trace-schemas）

1. [PR #130](https://github.com/loomake/loomake/pull/130) は通常 verify と全 CI が成功し、main `e4a7211` で受入済み。次に Issue #60 の既存 REQ-280 を `core-trace-schemas`（REQ-302〜REQ-304）で担当する。指定された parser の確定実装 `49f84d2` から専用 worktree を作成した。
2. OpenSpec strict と仕様ゲートは exit 0。全 3 要件を反映し、ブロッキング確認事項・未承認の仮定はない。
3. 現時点の未決事項・仮定なし。quality-report は別担当とし、この変更では扱わない。
4. 次は仕様ゲートを通し、構造と導出型だけを移して既存の同期処理と整合性検査を保持する。

## 構造の移行と配布準備

1. `core-trace-schemas` の 2.1〜2.3 を完了。4 構造の Zod・導出型・遅延 loader、trace の型と版の再エクスポート、Evidence/Report の 2 JSON と公開入口・配布利用側の確認・changeset を追加した。
2. focused 7 ファイル 49 試験、lint・型チェックが成功。既存 5 JSON は親 `49f84d2` とバイト一致。trace の既存関数本体と、evidence.ts・serialization.ts の全バイトを保持した。全体はローカルの容量・POSIX 制約を避け、ネイティブ Linux の CI で同じ完了ゲートを確認する。
3. 未決事項なし。最後の自己ゲートタスクは未完了のままにしており、change 全体の完了はまだ宣言しない。
4. 次は独立レビューと CI の品質試験を確認し、自己タスクをチェックした最終 head の完了ゲートへ進む。Issue #60 全体は close しない。
