## 外部操作診断の独立changeと観測修理

1. [PR #276](https://github.com/loomake/loomake/pull/276) の `classify-hook-budget-calls` でtask1.1〜4.1を実施し、既存の起動前中断・補正窓・版2の分類修理を独立changeへ正式化した。予約済みREQ-350〜352の全19 Scenarioを保持し、ADR 0006の包括承認に基づくA′・mode/cwd・取得時点の決定と回答者を記録して、元関数前の不活性snapshotの最小修理・新しいID付き試験・観測文書を追加した。
2. 初期の分類修理では追加25件の失敗後に関連61件・元hook1件・build/lint/typecheckが成功し、正式化時はmainを通常mergeして14ファイルの同一性とstrict・仕様ゲート15検査の成功を確認した。今回のREQ-350は修理前7失敗・5成功から修理後27件成功、自己点検の境界追加後30件成功となり、文書リンクを含む70件・分類70件・公開とworkflow85件・型検査・対象lintも成功し、初回通常doneの全2299件も成功・既存8件はpendingだったが、未チェックのゲート自身のタスクだけがFAILとなり、再実行で全2302件成功・0失敗・既存8pending、通常local doneの21検査がすべてPASS・exit0となった。
3. 当初の「changeなし・verify対象外」は後発Q-S1の読み誤りによる過去の判断として訂正し、通常L3・通常done・3 OS・必須CI・独立Opus最終を現在の受入条件とした。元hook・workflow・設定・予算・旧作業記録・製品runtimeと主仕様、公開の固定4ファイルと7日保存、正式化前以降の旧試験の本文・名前・期待値は保持しており、getter・Proxy・継承の不明を推測で埋めず、新たな確認事項はないが、新headのCIと独立レビューは未実施で、旧Windows版1やLinuxの成功を元失敗の再現や原因修理とは扱わない。
4. task4.1の通常local完了ゲートを省略指定なしで通し、全6タスクと19 Scenarioの対応を確認したため管理役へ返し、同headの3 OS・必須CI・独立レビューで最終の合格を確認する。noneと段階受入の例外は使わず、Issue #116の原因修理・closeはこのchangeの成果に含めない。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [#276](https://github.com/loomake/loomake/pull/276) | 未測定 | 未測定 | 未実施（新head） | 未実施（新head） | 進行中 |
