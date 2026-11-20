# Design: trace-static-evaluation（C2a）

## 範囲と参照

C1（PR #440/#441）と通知API（#446/#449）はmain受入・archive済み。本C2aは単一実行者の手動評価を通常L3で完成し、FIFOは通常C2b、statusは両C2のarchive後のC3で完成する。親#70と手動A20は未受入である。

全12要件・37最終Scenarioの所有表、C2bの最終4要件全文・未完タスクは[queue-transfer.md](queue-transfer.md)、C3の全原文・未完タスクは[c3-transfer.md](c3-transfer.md)を正とする。C2aは11要件・32Scenario（最終30件と中間2件）を持ち、C2bでもC2aのREQ-440台帳不正Scenarioを追加保持する。

データ形式の背景と元設計は[固定63bd79b7のdesign](https://github.com/loomake/loomake/blob/63bd79b75352a462c2a78abff4e1ea3ca4c9c5e5/openspec/changes/trace-static-evaluation/design.md)、採用判断は[trace.md](trace.md)の全回答・仮定を参照する。補足Opus02cc0530のC2a手順を採用し、旧FIFO手順はC2bへ移管した。Q70-25〜27は同補足の状態・ignore・回収を補正する。現在の規範は本changeの[品質仕様](specs/quality-evaluation/spec.md)と[CLI仕様](specs/reference-docs/spec.md)、既存静的観測は[主仕様](../../specs/quality-evaluation/spec.md)である。

## 保存と状態

requests.jsonlは要求イベント、attempts.jsonlは開始後の失敗、history.jsonlは評価の追記専用正本である。quality-report.jsonはhistory末尾の内容全体と等しい派生索引。eval.lockのtokenは{runId,requestId,pid,createdAt}で、wx/0600で最初から完全なtokenを作る。待機票とledger.lockはC2aでは作らない。

イベントの順序は行順で、atは表示・監査だけに使う。未登録→accepted→started→evaluated/failed/cancelled/abandoned、acceptedだけならabandoned/unrecoverableも認める。failed/abandonedは再評価待ちで、後の同条件の成功を参照するreevaluated、またはunrecoverableを一度だけ認める。evaluated/reevaluated/cancelled/unrecoverableは真の終端である。受付・開始・失敗・終端の重複、不正遷移・参照を2で拒否する。

(runId,attempt)はrequestsのstarted間とhistory/attemptsをまたいで一意。同runIdの別attemptは別組である。attemptは同commitのhistoryとattempts行数+1。失敗行・元の要求時刻は変更せず、同commit/qualitySha256の後成功によって失敗を解決済みと導出する。periodは観測時刻のUTC暦日で、翌日を別期間として保持する。

## runEval

1. 既存loadConfig・品質読取り・安全入力を使いconfig/quality.yamlと保存先/lockの種類を検査。不正は2。途中のリンク・特殊ファイルにも入らない。
2. UUIDのrunId/requestIdで実行権を取る。EEXISTは未受付3で、既存lockの内容/mtimeと全台帳を保つ。時刻/PIDで自動削除せず日本語で手動確認を案内する。
3. 台帳の改行/JSON/構造/一意性と索引の由来を先に検査。既知の文字列欄は変換せず文字列型を検査し、未知の追加欄は保持する。不正は何も書かず2、自tokenだけ片付ける。出どころ不明・読めない索引は上書きしない。
4. 自attempt採番前に残存要求を回収する。startedに対応するhistoryがあればevaluatedだけ補う。同組のattemptがあればrequestId/対象/基準の一致を先に確かめ、分類/日時/bytesを保持してabandoned(running)だけ補う。両方未記録だけcrashed（endedAt:null、detectedAt:現在）を追記する。acceptedだけならabandoned(waiting)。再評価待ちの対象/基準が現在と違うとき、同条件で後の成功がhistoryにあれば（startedがあればそのattemptより後、なければ受付より後の評価時刻）その組へのreevaluatedを補い、なければunrecoverable。欠落/古い索引は、索引以外の作業ツリー検査を通るときだけ末尾から復旧して評価を続ける。汚れていれば復旧せず6で1を返し、履歴と索引を変えない。回収イベントは採番を正しく保つため汚れていても書く。
5. 自attemptを採番しaccepted/startedを1回の追記・fsyncで保存する。失敗は自分の末尾だけ戻して2。
6. 下記の作業ツリー検査で汚れならdirty/failedを記録して1。
7. 前のtest report/固定coverage-summaryを消す。開始時刻を取りrunVerify({root,progress,onCommand})を一度だけ実行し終了時刻を取る。await setImmediate()で溜まった信号を処理する。実行順・期限・予算の分岐を複製しない。
8. abortはinterrupted/cancelled(running)で3。signal/interrupted/timeoutは対応分類/failedで3。error/output/通知欠落はlaunch/failedで3。HEAD/基準/作業ツリー/台帳変化はchanged/failedで1。これらではhistory/索引を保存しない。すべて数値終了ならreceipt判定へ進む。
9. 保存前に自tokenを確認。他tokenならhistory/attempts/索引へ書かず3、startedは次所有者へ残す。history追記/fsync失敗は自分の末尾だけ戻しsave/failedと2。戻せなければ不完全な末尾と手動復旧を案内し既存行を保つ。
10. 索引を一時ファイルからrename。失敗はhistory/古い索引を保ち2。成功ならevaluatedと同条件の再評価待ちへのreevaluated（今回のrunId/attempt・現在時刻）を追記。
11. finallyで同じ自tokenだけ削除する。保存成功は判定FAIL/不足でも0、汚れ/変化1、入力/台帳/保存不正2、競合/実行不能/中断/token喪失3。

すべての台帳書込みはwithLedgerWriteで所有確認する。C2bで内部をledger.lockへ拡張する。生存中lockの手動削除等の外部介入と保存前確認の間の完全な直列化は保証しない。token喪失側は補償のattemptsも書かず、次の実行時に不正を拒否・回収する。

## 作業ツリーと観測

git status --porcelain=v1 -z --untracked-files=allを使う。自lockの??、3つのjsonlの??/空白MかつHEAD版raw blobを同一prefixに持つ追記、構造検査済み索引の??/空白Mだけ許可する。staged/削除/改名/モード変更/他パス（週次Markdownを含む）は1。ignoredでもpath/ownerを検査し、unignoredでも正規own lockの??を許可する。gitignoreは変えない。コマンド前後の4帳簿の存在と全bytesを比較し、stage/commitしない。

C1 observeStaticMetricsとkitの四値集約を使いPQ/UQとblockingUnmetを保持する。設定済み全コマンドのexited通知が必要で、testの終了0だけで完了とはしない。正常失敗の条件Eは実測済みVitest5.0.5に限る。今回のproducer/版を照合し、JSON object/testResults、success:false、全5整数カウンタとassertionsの一致、runtime error未指定/0、wasInterrupted非true、全ファイルpassed/failedかつassertion1件以上、全assertion passed/failedを必要とする。skip/pending/todo/未知状態は終了コードと成否にかかわらず拒否する。

終了0でも保留・failed/runtime error/interrupted/件数不整合等の明示的不完全性を拒否する。保留を含む成功レポートもreceipt:nullとし、test/coverageを値なしnot_runにする。C1の純粋関数が保留を実施件数から除く契約と、collectorが完了を照合してreceiptを渡す条件を区別する。通常失敗/ラッパー0は実件数と実終了のcommands成否を保持する。lint/typecheck非0も数値終了を保持し、error_countを捏造しない。

bail/部分/未確認はreceipt:null、test/coverageは値なしnot_runとし、detailだけ「途中で止まった可能性を否定できないため、件数を測定していません（reason）」へ差し替える。C1のstatus/evidence/APIは変えない。P1実測は固定旧treeの.loomake/c2-plan/p1/を参照（同じ3ファイル6件の通常失敗5/1とbail1、各wrapper0）。pending/空ファイルでこのbailを拒否できた事実に限り、全hidden bailを排除したとはしない。Jest未導入/未実測、未知producer/版の失敗は昇格しない。旧79bのVerifyResultのみ・4dの0完了推定は不採用。

## CLI・検証・規模

trace packageはrunEvalだけCLI向けにexportする。既存runのgraceful条件をtrace evalへ広げ、最初のabort、2回目130/143/129、100ms未満のHUP重複除外を保つ。親だけの信号はspawnSync終了後のsetImmediateで処理する制約、強制終了時lock残存と手動削除後回収をガイド/試験に含める。

共通CLI定義にevalを最後に追加しhelp/候補/不明オプション2/生成referenceを追従する。固有オプション・設定を増やさず、旧reportのchange必須・schemaVersion:2・引数/終了コード、公開12schemas・依存範囲・旧assert/skip/期限/設定を保つ。0.xの互換追加はpatch。

ゲート・全Scenario試験・通常local完了、非起草Codexと独立Opus、最終headのscope ci/必須5/通常3OSはtasksとADR0006に従う。B0実測78000B。B1実測145212B/残見込み68000Bを管理役へ報告済み。Q70-24aに従い置換済み非規範説明だけを固定出典へ整理する。195KiBは相談のsoft checkpointで、投影だけで実装を止め続けない。各taskで全diffを実測し、200KiB hard cap超なら外部レビュー/PR送信をせず管理役へ戻す。全規範/移管原本/回答/仮定/試験は保持し、差分除外・binary化・minifyは行わない。
