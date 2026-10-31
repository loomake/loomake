# [PR #253](https://github.com/loomake/loomake/pull/253)：行登録基盤の依存統合とcompanion本体の修理

2026-11-01（日本時間）の依存統合と本体の部分修理を検証した時点の記録。この記録の追加後の CI・独立レビューの結果は、PR 本文の証跡を参照する。

1. やったこと：split-slow-ci-checks の2.7の部分修理R1〜R3を統合し、2.10のcompanion本体とhelperの評価・setter検査を追加した。元SHALL・Source・先頭11Scenario・task本文・旧期待を保持し、新しい採用条件はtraceへ記録した。
2. verify の結果：旧447件を含む関連512件（skip0）とlint・型検査・仕様ゲート・strictが成功し、修理前の57失敗とnativeの偽受理を保存した。native1起動の7件は全成功で、helper-one・take派生2件・呼出し時登録を両入口で拒否し、既存getTest診断と実canonicalの受理・全raw/ledgerを保った。
3. 確認事項・仮定：tasksは2/21のままで、2.7・2.10全体・行wiring/C1/oracle・実登録/OS割当・3OS・全体doneは未達である。原getTest入力は旧APIの偽受理証拠ではなく、対応名・拡張子の補正とtakeへの改名を分けた派生を対照にした。
4. 次にやること：管理役が差分容量・CI・独立レビューと残る登録基盤を確認する。部分修理をmainマージやchange完成とは扱わない。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [#253](https://github.com/loomake/loomake/pull/253) | 採用設計に従う（PR全体は未測定） | 進行中（全体の完了ゲート未達） | 新 head は未実施 | 0（独立最終レビュー未実施） | 進行中 |

2026-11-01（日本時間）、Q114 による未参照 ImportEquals の局所修理を追加した。

1. やったこと：split-slow-ci-checks の2.10に対し、第13Scenarioとtrace・design・ci文書を整合させ、仕様ゲート後にcompanion内の全位置のImportEqualsを既存の依存検査へつないだ。旧R4診断、純粋API、helper側の拒否を保持した。
2. verify の結果：旧コードでは追加7件中6件が失敗し、修理後は旧512件を含む関連519件が成功した（skip0、最終実時間11.690秒）。lint7.868秒・型検査2.518秒・ビルド込み仕様ゲート3.812秒・strict0.861秒もexit0。追加nativeは隔離verbatimで3suite・4成功行、原false-source反例も入力をbyte保持した別fixtureで1suite・1成功行を確認し、両入口の拒否・outなし・raw/ledger不変を検査した。安全なhelperは依存hashを記録し、型専用は読込0回・依存hashなしで受理した。
3. 確認事項・仮定：Q114は利用者（ADR 0006 の包括承認）を回答者として管理役が採用した。既定設定の0行suite errorは安全性の証拠に数えない。元の仕様本文・Source・先頭11Scenario・残るScenario・旧試験・tasksをbyte比較で保持し、tasksは2/21のまま。全体done・3OS・CI・独立最終レビューは未達である。
4. 次にやること：管理役へ局所結果と実差分容量を渡し、依存基盤のPR分割、現在headのレビューと残る完了条件を進める。この記録は部分修理のローカル検証である。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [#253](https://github.com/loomake/loomake/pull/253) | 採用設計を受領（全体未測定） | 関連回帰11.690秒、実装全体は未測定 | 新 head は未実施 | 今回0（独立最終レビュー未実施） | 進行中 |
