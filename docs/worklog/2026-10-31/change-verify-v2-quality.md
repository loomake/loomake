# C001 の分割 5/6（verify-v2-quality）の 1 本目

1. やったこと：子 change `verify-v2-quality` のタスク 1.1・2.1・2.2。親から REQ-319 を既存 ID のまま移し、親の tasks 3.1・3.3 と trace に移したことを書いた。core に `parseTestReport`、kit に `ci.test_report` の adapter `observeTestReport`（純関数）を足した。差分が 90 KiB を超える見込みのため、runVerify への接続（3.1・3.2）と統合試験（4.1）・受入（5.1）は 2 本目の PR に分け、途中の接続はブランチ `change/verify-v2-quality-wiring` に置いた。
2. verify の結果：`--spec-only` は exit 0。`--done` は exit 1 で、不合格は未完了のタスク（3.1・3.2・4.1・5.1）の 1 件だけ。`pnpm lint`・`pnpm typecheck` は成功し、`pnpm test` は changeset をコミットしたあとの再実行で全件が通過した。
3. 残っている確認事項・仮定：Q-01〜Q-06 はおすすめ（A）で仮実装し、管理役の確認待ち。Q-07（2 本に分けたときの 1 本目の完了ゲート）は、作業計画の指示どおり未完了のタスクを残して出した。おすすめは B（1 本目には完了した分だけを置く）。
4. 次にやること：2 本目で接続を仕上げる。既存の done・ci の試験 59 件の準備に quality.yaml・git・producer・新しい startTime を足し、統合試験を書いて `--done` を通す。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| 進行中（作成前） | 対象外（design-step8b で代替） | 進行中 | 未実施 | 未実施 | 未実施 |
