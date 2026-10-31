# 速度対策1-1（PR184）

1. `split-slow-ci-checks`のタスク2.5として、登録済みcompanionの実結果を元sourceへ結ぶ監査と、独立ASTによる宣言・登録検査を実装した。元REQ-347の本文・3つのScenario・Source、raw report・レビュー表、既存scanner・partition・Vitestと実registry空を保った。追加G-B設計に従い、通常fixture helperをbindingで分類し、namespaceやalias経由の自身の宣言を見逃す問題も回帰試験とともに修正した。
2. 関連177件、spec-only、build、型検査、lint、差分検査が成功した。別Codexの独立点検も139件が成功し、未解決の重大・軽微指摘はゼロだった。main取込後の前段CIは全3OS・Node22・CodeQLが成功したが、gateは未完了タスクで失敗し、隔離WindowsにはTemp導入の既存120秒timeoutが残った。この失敗はIssue181に保存し、再実行や条件変更はしていない。
3. 分割前の旧全件測定9本は7成功・Windows2失敗で未受入である。元の15file限定測定、Linux隔離fixture、同じit.each内の本文hashを、最新全件・3OS・全parameterの保持の証明へ流用しない。G-Bの静的候補数の見積の誤りは、元sourceを変えず独立実測で訂正し、通常helperや同名実行行を除外して帳尻を合わせていない。
4. 進捗は7/16、完了ゲート後の必須受入3件も未達である。次にGit読取集約を含む最新mainを実装ブランチへ取り込み、旧guards全本文と新しい2宣言の保持を照合して再検証する。残設計、実case分割、全PRのslow不実施、最終測定、REQ-297の時間上下限と時計、coverage、local/release全件、人のnode20-only規則操作、独立最終レビュー・マージ・sync/archiveを残す。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [184](https://github.com/loomake/loomake/pull/184) | 残設計と最新mainの追加試験照合 | 進行中（7/16） | 次のコードheadで検証 | 最終レビュー未実施 | 必須受入未達・未マージ |
