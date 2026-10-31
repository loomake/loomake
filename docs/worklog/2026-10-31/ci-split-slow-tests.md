# 速度対策1-1（PR184）

1. `split-slow-ci-checks`の先行実装2.1〜2.4を保持し、追加のOpus設計に従ってREQ-347の差分、proposal・design・tasks・traceを更新した。元のRequirement本文・3つのScenario・Sourceと既存15タスクを残し、監査・登録宣言検査を未完了の2.5として追加した。本文を元testに残す方式を採り、実registryは空のままとした。
2. 追加仕様の`verify --spec-only`とchangeのstrict検査は成功した。前段のmain統合後は関連108試験・build・型・lintが成功した。最新headのCIはUbuntu・macOS・Node22・CodeQL・隔離試験が成功したが、Windowsの夜間変異試験2件と未完了タスクによるgateは失敗した。Windowsの同じ改行差を修理したPR230はmainへ受入済みであり、次の統合後に改めて確認する。
3. 分割前の全件測定9本は7成功・Windows2失敗で、測定の受入は未完了である。元の15file限定測定やLinuxの隔離fixtureの成功を、最新headの全件・3OS・監査の合格へ流用しない。同名実行行の多重度を保持し、同じit.each内のparameter欠測は本文hashだけでは証明せず、独立した全case比較へ残す。
4. 進捗は6/16、完了ゲート後の必須受入3件も未達である。次に最新mainを取り込み、別担当による期限試験の移動前後を照合して、2.5の実装と残9fileの設計を進める。元case・parameter・assert・timeout・skip、coverage、REQ-297の時間上下限と時計、local/release全件、人のnode20-only規則操作、独立レビュー・マージ・sync/archiveの条件を保つ。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [184](https://github.com/loomake/loomake/pull/184) | 残9fileと既存設計の統合照合 | 進行中（6/16） | 次のmain統合後に検証 | 最終レビュー未実施 | 必須受入未達・未マージ |
