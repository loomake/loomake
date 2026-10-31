# [PR #253](https://github.com/loomake/loomake/pull/253)：companion監査と行登録基盤の局所修理

2026-11-01（日本時間）。過去の検証と今回のS1修理を区別して記録する。CI・独立レビューの正本はPR本文の証跡とする。

1. やったこと：split-slow-ci-checksの2.7のR1〜R3と2.10の本体・helper・ImportEqualsを統合し、今回Q116の仕様ゲート後に型位置以外のthisを拒否した。M1の説明を文言不変で移し、M2の同日記録を1節にまとめた。元SHALL・Source・先頭11Scenario・旧期待・task本文を保持した。
2. verifyの結果：初期helper修理は旧447を含む512件成功・修理前57失敗、native7行成功。その後Q114では新7件中6件のREDから519件成功（11.690秒）、lint7.868秒・型2.518秒・仕様ゲート3.812秒・strict0.861秒を確認した。今回S1は旧519と新9の528件中7失敗のREDを保存し、修理後528件成功・skip0（9.262秒）。新native1起動の3suite・3成功行で、false-sourceと派生の差を保ち、top/arrowの両入口拒否・出力なし・raw/台帳不変とcanonical受理を確認した。今回のlint・型・仕様ゲート・strictも成功した。
3. 確認事項・仮定：Q116は管理役がOpus推奨Aを利用者（ADR 0006 の包括承認）の回答として採用し、局所thisも拒否する影響を記録した。元反例は再実行せず保全し、0行suite errorは成功に数えない。原getTestは旧API偽受理の証拠ではなくtake派生と区別する。tasksは2/21のまま。既存native3件の固定保存先はM3としてIssue258で追跡し、今回増やさない。
4. 次にやること：管理役が新headの自己レビュー・独立再レビュー・CIと差分容量を確認する。旧headでは3OS品質が成功したが親gateは未完taskで失敗し、今回の新headのCIは未実施。2.7/2.10全体・wiring/C1/oracle・実登録/OS割当・全体doneは未達で、部分修理をマージやchange完成とは扱わない。
