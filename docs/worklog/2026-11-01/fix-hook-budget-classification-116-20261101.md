## 外部操作の中断と時計窓の分類修理

1. Issue #116 の後続として、起動前中断の区別・時計窓・版2の公開schemaと表示、getterを追加評価しないtimeout有無の観測を実装した。ADR 0005 の開発診断のためchangeとタスク番号は対象外で、PR は管理役が起票する。
2. 修理前に25件の追加試験で失敗を確認し、修理後は関連61件・元のhook試験1件とbuild・lint・typecheckが成功した。changeなしのためverifyは対象外。
3. 旧headのWindows単独sampleは履歴として保持し、今回のLinux回帰をWindowsや元失敗の再現へ読み替えない。getter・Proxy・継承した設定は不明として残し、Issue #116 の原因解明と必須CI・3 OS・独立レビューは未達である。
4. 管理役がPRを起票し、作者と別の自己レビュー・Opus最終・同headのCIを確認する。元のhook・assert・予算・設定・製品コード・公開する固定4ファイルと保持期間は変えていない。

## 独立changeの正式化（PR #276）

1. `classify-hook-budget-calls` の計画文書を作成し、予約済みREQ-350〜352と全19 Scenarioを記録した。上の「changeなし・verify対象外」は後発Q-S1の読み誤りによる過去の判断で、現在は独立changeの通常L3として訂正する。診断コードがchangeより先に入った履歴は保持する。
2. main3aを通常mergeし、保護8pathと対象技術source/tests計14pathの同一性を確認した。OpenSpec strictと仕様ゲートが成功し、15検査のFAIL・不足・pendingは0。追加試験、修理、正常done、最終CI/レビューは今回実行していない。
3. 42a5追加設計のA′・新capability内の3件のADDED・mode/cwd・Q6(a)を管理役が採用し、traceへ決定と出典を記録した。窓内のtimeout不明を一律未確定とした旧草案は採らず、本文460/498/384 UTF-16で採用原文の条件を保持する。
4. 管理役の仕様確認後、task1.1から自己変化する設定のREDと最小修理へ進む。全19 ScenarioのID付き追加試験、正常done、同headの3 OS・必須CI・独立Opus最終を通常条件で満たすまで、PR #276とIssue #116を完了とはしない。

## A′の修理と全19 Scenarioの追加（PR #276）

1. `classify-hook-budget-calls` のtask1.1〜2.2を実施した。traceのF116-Q2〜Q6の回答者をADR 0006所定の「利用者（ADR 0006 の包括承認）」へ直し、Q5の予約実務を担当した管理役と決定権限を区別した。仕様ゲート成功後に、診断env確認直後・t0前の不活性snapshotへobserverを最小修理し、REQ-350〜352の全19 Scenarioを新しいID付き試験で検査した。元の試験本文・名前・期待値は変更していない。
2. REQ-350の追加試験は修理前7件失敗・5件成功、修理後は旧試験を含む27件すべて成功。task1.2の観測・リンク検査は70件、task2.1の分類検査は70件、task2.2の公開・workflow検査は85件が成功し、typecheckと対象lintも成功した。全タスクの完了照合と通常doneはこれから実施する。
3. 基点aeee・正式化前241・正式化bce61e01・修理後b285e76eを照合し、元hook・両workflow・設定・lock・旧267記録・製品runtimeの9ファイルが同一だった。classifierの基点から241までの差分は既存の分類修理であり、241以降は同一。今回のobserver修理と3試験ファイルへの末尾追加を分けて確認し、製品srcと主仕様、採用した3 ADDEDの原文には差分がない。新たな確認事項はない。CIと独立Opus最終は未実施。
4. task3.1の記録を確定し、task4.1の正常doneを省略指定なしで通す。通常L3を維持し、none・段階受入の例外は使わない。localの完了確認後は管理役へ返し、同headの3 OS・必須CI・独立レビューを確認する。Issue #116の原因修理やcloseはこのchangeの範囲外である。
