# E3 S4のguard群化（Issue #246）

1. やったこと：task2.5の群化に対する軽微3件を修理し、空の文脈行の表示、不正UTF8名の空差分、群間の共有期限を回帰した。runnerのpatch changesetを加え、設計と適合確認の参照先をPR #261へそろえた。
2. verifyの結果：新batch64件を含むrunner488件と、前回に含めた別配置の既存変異試験1件が成功し、失敗0・skip0。REQ-056の対象5件も成功した。型・lint・build・strict・spec-only・changeset statusは成功し、1200file・60秒・8192+152・元assertを保持した。Linuxの結果で3OSを代用しない。
3. 確認事項・仮定：task2.5のみ完了で5済14未。task3.5はmacOS/Windowsとpush期限順の受入まで未完了で、S1のgate/merge・親done・実4件0/4・P6未成立も残る。規則や品質設定は緩めていない。
4. 次にやること：管理役が修理後の独立レビューとCI・runner3OSを確認する。Windowsではdiff転送成功がpush停止より前にあることを実ログで確認し、3.5をその前に完了にしない。S2全6taskと71件候補を後段へ保持する。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [PR #261](https://github.com/loomake/loomake/pull/261) | 対象外（適合を確認した既存設計の再利用） | 進行中（親done未達） | 完了（受入headの全3OS・専用Windows成功、gateは宣言どおりFAIL） | 2 | 段階受入済み（時間未測定） |

## task 3.5 の不足修理：S4 単独で Windows の操作順を確認する準備

上段の数値と計測表は初回修理時点の履歴である。現在の検証・レビュー・CI は PR 本文の証跡を正本とする。

1. やったこと：管理役の採用判断に従い、[PR #271](https://github.com/loomake/loomake/pull/271) の Windows 診断 workflow・集計 script・試験 2 ファイルを原文のまま [PR #261](https://github.com/loomake/loomake/pull/261) へ移した。既存の Opus 設計を読み、S4 の正常 fixture と不変の診断経路で使えることを照合した。S2 の異常結果処理への依存はなく、task 2.5 と 3.5 を同じ S4 に残した。
2. verify の結果：移植前後の spec-only と strict、lint・型検査が成功し、ガードと公開制御を含む関連 147 件は成功・失敗 0・skip 0。S4 単独の Linux で元の push 試験 1 件と集計が成功し、context は 21,899B で実現性ゲートの 56KiB 以内だった。150 操作の中で content diff 成功の終了位置 54 が push 停止位置 149 より前にあり、間隔は 841ms だった。Linux の準備結果を新 head の Windows・3 OS・親 done の成功には数えない。
3. 確認事項・仮定：元の製品・試験・helper・通常 CI・設定・予算・task 印と全仕様を保持した。5 済 14 未・実 CLI 0/4・P6 未成立を保ち、task 3.5 は新 head の Windows 診断と 3 OS の照合まで未完了とする。元 PR で追跡済みの軽微 2 件も Issue #246 に残す。
4. 次にやること：作者と別の自己レビュー後、管理役が残り 1 往復の独立 Opus レビュー、新 head の通常 CI・全 3 OS と専用 Windows 診断を確認する。診断の公開物は検証済みの固定要約 2 ファイルだけで、生 context と試験の出力・レポートは集計後に削除した。cancel や runner の異常終了時の確実な削除は保証せず、未達の親受入を省かない。


## S4 の段階受入後の記録

1. やったこと：管理役が [PR #261](https://github.com/loomake/loomake/pull/261) を指定統合先へ受け入れた後、次段 S2 の枝で task 3.5 の受入を記録した。S4 の 2.5 と 3.5 の配分は保ち、計測表の往復 2 と CI の実績も独立レビューの軽微指摘に従って修理した。
2. verify の結果：受入 head の通常全 3 OS・Node20/22・CodeQL と専用 Windows が成功し、固定要約と対象 head・操作順を管理役が照合済み。gate は宣言した 14 task と REQ-340/341 の試験不足・同不足による品質証拠不足で失敗した事実を保持する。
3. 確認事項・仮定：この記録は S4 の検証と統合受入の確認であり、親 change の done・実 CLI 0/4・P6・最終受入は未達である。S4 の source と試験は変更せず、次段 S2 の再検証は別に行う。
4. 次にやること：管理役が S2 の最新親を含む差分と回帰・独立レビュー・CI を確認する。旧 proof の 4 ファイルは S4 に取り込み済みで、後続 PR #271 では重複を明記して扱う。
