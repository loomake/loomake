# 計測欄の追加（2026-10-30 18:45:57 JST）

1. やったこと：[PR174](https://github.com/loomake/loomake/pull/174)、依頼1-6。AGENTSの計測表の例外とdelivery SKILLの5欄・区間定義・週次手順を追加した。ADR0005の文書変更でchangeとtasksは対象外。
2. verify：関連66試験と差分の空白確認は成功。製品spec-only・doneは対象外。通常verify・lint・型・全体試験、独立Opus最終レビューは未実施。最新結果と最終headはPR本文へ記録する。
3. 確認事項・仮定：欠測を推定しない。週次の常駐や定期投稿は未設定。mainの別のESRCH試験失敗は[Issue175](https://github.com/loomake/loomake/issues/175)で追跡する。
4. 次：最終headで既存CI・自動Codex・独立Opusレビューをそろえ、既存管理役へ引き継ぐ。

記録時の文書差分headは`410f651d1c43cd7e88cab70dc841f0ec9f4c344c`、観測は2026-10-30 18:45:57 JST。この記録の追加後のheadと確定値はPR本文、マージ後の値は次の作業PRへ残す。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [174](https://github.com/loomake/loomake/pull/174) | 対象外（agent-workflow 2章の明確な文書変更として省略） | 進行中（18:41:57 JST開始、上記観測時刻まで） | 未収集（結果の取得前） | 未実施 | 進行中（18:45:10 JST作成、上記観測時刻まで） |
| [169](https://github.com/loomake/loomake/pull/169) | 対象外（文書変更として省略） | 未測定 | 内訳は未測定（最終headのCI作成→更新306秒は[元記録](https://github.com/loomake/loomake/issues/121#issuecomment-6516185055)） | 1（正常な最終レビュー2回） | 12189秒（3時間23分09秒、14:32:37→17:55:46 JST） |

PR169の対象headは`b96b539f78bb2f913e281fd30d2ecde37e51f666`、mergeは`9a3fe04a89da68e67334a5b535bd5f967428a2b6`。マージ日時はGitHub PR APIで照合し、[元の作業記録](https://github.com/loomake/loomake/blob/b96b539f78bb2f913e281fd30d2ecde37e51f666/docs/worklog/2026-10-30/docs-delivery-overlap-pipeline.md)の確定値をこの次作業へ追記した。工程時間は足し合わせず、実工数とは扱わない。
