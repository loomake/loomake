# E3 の独立設計確認と実装引継ぎ

1. やったこと：validate-engine-json-result task1.3。head6c951b9の既存Opus A1/A2/A3/Bを照合し、管理役が採用した分類・AfterGuard・全OS長path試験・閉集合fixture・非永続化条件を計画へ記録した。8差分Requirement/41Scenarioは無変更。今回の重複起動417111fcは停止・未実施として保持した。PRは未作成。
2. verify：計画反映後のstrict/spec-onlyはexit0、全15検査。diffcheck成功。4計画文書をyomiyasuで点検し、契約用語と承認された変更は保持した。A3の未読資料を確認済みとは扱わない。
3. 残る事項：実CLI2版4件は保護前提が未確認のため未収集。採集・製品実装・done・CI・自動Codex・独立最終レビュー・親DoDは未完了。
4. 次：仕様ゲートを通した計画を固定し、task2.1の純粋分類から実装する。既存テスト・期待値・設定を保持し、採集待ちに依存しない製品D01〜D05を進める。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| 未作成 | 未測定（既存4設計の再利用と管理採用） | 未実施 | 未実施 | 未実施 | 対象外（PR未作成） |

根拠：Issue121の予約コメント6524458298、design7章、trace E3-D01〜06、専用treeの `.loomake/e3-revised-design/existing-design-audit.json` と各Opus原本。全体の完了報告ではない。


## task2.1 の純粋分類

1. やったこと：元の標準出力をJSONで分類し、失敗の合図を型不正より先に判定する純粋関数と、分類・許可subtype・出力パスだけから理由を作る関数を追加した。新規37件を追加し、既存試験は変更していない。
2. verify：新規37件と既存45件の計82件、型確認が成功。対象lintの改行指摘1件を直して再確認する。task2.2のrun接続と全体doneはまだ実施していない。
3. 残る事項：task2.2以降、実CLI4件、CI・自動Codex・独立最終レビュー・親DoD。
4. 次：holdとAfterGuard、既存guardの表示・index解除をtask/repair両経路へ接続する。


## task2.2 のguardと停止への接続

1. やったこと：保存後の元raw分類をholdへ接続し、task/repair両方で既存guardの表示後にAfterGuardを判断する。E3単独時もindexを解除し、タスク完了・commit・NoChange・再gateへ進めない。fake engineには任意欄だけを追加し、従来の出力と既存assertは保持した。
2. verify：純粋分類53件、既存45件、既存run70件・NoChange25件の193件と、新規run統合11件がすべて成功。型と対象lintも成功した。元rawと保存後JSONの形が変わる回帰、guard削除表示、Git内部変更の理由順、直しの再gate禁止を確認した。
3. 残る事項：task2.3の保存予算/保存失敗と長path回帰、task2.4以降、実CLI4件・done・CI・自動Codex・独立最終レビュー・親DoD。
4. 次：既存recorderを変えず、全OSで長pathとsummary/stop保存失敗を確認する。


## task2.3 の既存記録経路の再利用

1. やったこと：通常表示の完全path、予約超過のstop形式、分類後summary/stop保存失敗、分類前output保存失敗の区別を回帰で固定した。recorder/logs/log-policyは変更していない。長pathは文字列を渡したstartRecordingの直接試験で全OS共通にし、新skipを加えていない。
2. verify：新規記録5件と既存記録6件の11件、型、対象lintが成功。多数の実違反でsummary予約超過を発生させる新規1件は、このLinux観測で約20秒だった。Windows/macOSでの実行は未実施。
3. 残る事項：task2.4以降、全OS CI、実CLI4件・done・自動Codex・独立最終レビュー・親DoD。
4. 次：正常な結果の正例と、既存利用側・全Scenarioの対応をそろえる。


## task2.4 の正常経路と既存利用側

1. やったこと：正常metadata、未知の文字列/欄、空result、NoChangeと完了ゲートの正常経路、先行完了commitの保持、repairで禁止変更が重なるときの表示を新規回帰に追加した。既存fakeの出力とassertは変えていない。
2. verify：新規run16件と既存guard40件・特殊guard8件の64件、型、対象lintが成功。tasks1.3と製品実装2.1〜2.4までを固定した。
3. 残る事項：3章の全Scenario/変異/provenance確認、実CLI4件、done・CI・自動Codex・独立最終レビュー・親DoD。
4. 次：失敗優先・理由順の変異を新規直接試験で検出し、全Scenarioとの対応を点検する。


## task3.1 の直接試験と変異検出

1. やったこと：新規53直接試験へ、失敗優先・AfterGuardの理由順・suffix上限を逆にしたコピーを渡す独立変異試験を追加した。既存45件と既存変異試験の期待値は変更していない。
2. verify：新規変異baselineは53/53、3変異はすべてassertion失敗として検出した。既存の6変異も既存45件で検出し、両外側試験が成功した。型と対象lintも成功。
3. 残る事項：3.2以降、実CLI4件・done・CI・自動Codex・独立最終レビュー・親DoD。
4. 次：保存/停止/正常経路の全Scenario対応を確かめ、fixtureの出所と保存許可を実装する。


## task3.2 の保存/停止の全Scenario確認

1. やったこと：REQ-340の全8ScenarioとREQ-179の保存段階を新規統合/記録試験へ対応付けた。異常JSON自体のoutput保存が予算を超えた場合も、分類済みの理由を足さない負例を追加。必要なrunner patch changesetを先行して用意した。
2. verify：新規保存予算負例は成功。通常/短path/長path/summaryとstop I/O失敗/guard重複/元raw分類は前記の成功結果と照合した。41Scenarioの対応表は専用treeのscenario-test-map.jsonへ保存した。全体verifyはこれから。
3. 残る事項：3.3以降、実CLI4件・done・CI・自動Codex・独立最終レビュー・親DoD。changeset作成だけではtask5.1完了としない。
4. 次：旧全Scenarioと既存停止順の回帰を通常verifyで確認する。


## task3.3 の全体回帰

1. やったこと：旧20Scenarioと追加Scenarioを含む全41件の対応、停止の優先順、HEAD/branch/Git内部変更、中断/上限/質問、正常なcommit/NoChange/gateを照合した。8差分本文は6c951b9から全byte不変。a1のREQ-100追加Scenarioも保持した。
2. verify：head432ad60の通常pnpm verifyはexit0。lint・型・全体1589成功/失敗0/既存skip8。実行中のheadとtracked cleanを保持し、原レポート・loghash・受入範囲を専用treeのnormal-verify-receipt-432ad60.jsonへ保存した。
3. 残る事項：3.4の保存schema/provenance確認、実CLI4件、製品done・CI・自動Codex・独立最終レビュー・親DoD。全体の通常verify成功を未収集の実観測へ流用しない。
4. 次：採集を起動せず、閉集合projectionと全型derivedの検査を共通モジュールへまとめる。


## task3.4 の保存schemaと出所

1. やったこと：scripts/claude-result-fixture.mjsへ閉集合projection、全型derived、metarecord/syntheticの区別、各階層の追加欄拒否とcross-field検査をまとめた。元rawをメモリ内で直接投影し、元の存在/型と分類/表示合図を保存前に比較する。採集は起動していない。
2. verify：新規66合成回帰が成功。4欄×全JSON型、許可外の値・原raw hash・未知metadata・置換不一致を拒否し、失敗実行やcase不一致を収集へ数えないことを確認した。型と対象lintを確認し、固定headの通常verifyはこれから再実行する。
3. 残る事項：tasks4.1〜4.4と5章。実CLI2.1.307/2.1.308×success/error_max_turnsは0/4で、非永続化等の前提が未確認。親done・CI・自動Codex・独立最終レビュー・初回配布全体は未完了。
4. 次：今回headの全体verifyを確認し、管理役へ製品D01〜D05と未収集の受入を分けて引き継ぐ。
