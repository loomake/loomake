# [PR #253](https://github.com/loomake/loomake/pull/253)：行登録基盤の依存統合とcompanion本体の修理

2026-11-01（日本時間）の依存統合と本体の部分修理を検証した時点の記録。この記録の追加後の CI・独立レビューの結果は、PR 本文の証跡を参照する。

1. やったこと：split-slow-ci-checks の2.7の部分修理R1〜R3を統合し、2.10のcompanion本体とhelperの評価・setter検査を追加した。元SHALL・Source・先頭11Scenario・task本文・旧期待を保持し、新しい採用条件はtraceへ記録した。
2. verify の結果：旧447件を含む関連512件（skip0）とlint・型検査・仕様ゲート・strictが成功し、修理前の57失敗とnativeの偽受理を保存した。native1起動の7件は全成功で、helper-one・take派生2件・呼出し時登録を両入口で拒否し、既存getTest診断と実canonicalの受理・全raw/ledgerを保った。
3. 確認事項・仮定：tasksは2/21のままで、2.7・2.10全体・行wiring/C1/oracle・実登録/OS割当・3OS・全体doneは未達である。原getTest入力は旧APIの偽受理証拠ではなく、対応名・拡張子の補正とtakeへの改名を分けた派生を対照にした。
4. 次にやること：管理役が差分容量・CI・独立レビューと残る登録基盤を確認する。部分修理をmainマージやchange完成とは扱わない。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [#253](https://github.com/loomake/loomake/pull/253) | 採用設計に従う（PR全体は未測定） | 進行中（全体の完了ゲート未達） | 新 head は未実施 | 0（独立最終レビュー未実施） | 進行中 |
