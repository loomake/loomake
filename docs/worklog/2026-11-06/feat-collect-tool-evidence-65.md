# collect-tool-evidence（Issue #65 P2）

1. **やったこと**：REQ-448〜450、tasks 1.1〜4.2 を実装し、normal の L3 として main の Effort API を統合した。競合した core の公開入口と README は両側を残し、5 parser・collector・全 30 Scenario・全 10 tasks を保持した（PR 未作成）。
2. **verify**：統合前の通常の完了ゲートは実終了 0・21 検査 PASS だった。統合後の仕様ゲート・strict・型検査・lint・core 149 件と kit 42 件・依存方向試験、pack した配布物の Effort 1・要約 1 と全 parser/collector の runtime・型の共存確認は成功し、通常の完了ゲートを再実行する。
3. **確認事項・仮定**：Q-P2-01〜08 は管理役が決定済みで、未回答と未承認の仮定はない。Claude json の実 fixture と Biome の CI stdout・max-diagnostics 適用の未観測、P3 と親 #65 の未完了は引き続き残す。
4. **次にやること**：統合後の clean head を固定して通常の完了ゲートを実行し、管理役へ独立レビューと必須 CI・3 OS 試験を引き継ぐ。元の JSON Schema 13 本、品質設定・依存・既存 assertion・skip・timeout は保持し、既存 helper は export 指定の追加だけで本文を変えていない。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| 未作成（Issue #65 P2） | 未測定 | 進行中 | 未実施 | 未実施 | 未実施 |
