# Design: trace-static-evaluation（C2a）

## Contextと確定した範囲

既存品質コマンドの手動実行と履歴・単一実行者の要求追跡を一つの通常L3で完成する。C1は受入済みで、REQ-430を再実装しない。通知APIのPR #446と同期archiveのPR #449もmainへ受入済みである。C2b `add-quality-eval-queue` はFIFO・待機票・ledger.lockを完成し、C3は両方の受入・archive後に保存済み判定からstatusを生成する。親#70と手動A20の受入はC2b/C3へ残し、部分段階受入の例外を使わない。

採用済み補足設計は02cc0530である。最終の全12要件・37 Scenarioのうち、本PRは11要件・32 Scenarioを持つ。30件は最終規範そのまま、REQ-434の競合とREQ-440の台帳不正はC2aの契約である。C2bが残る7件を受け入れ、C2aで受け入れた台帳不正も追加保持する。`queue-transfer.md`に434・439・440・442の最終全文と未完タスク、`c3-transfer.md`にstatusの全原文と未完タスクを保持する。

## 原本と置き換え

[63bd79b7の旧design](https://github.com/loomake/loomake/blob/63bd79b75352a462c2a78abff4e1ea3ca4c9c5e5/openspec/changes/trace-static-evaluation/design.md)のFIFO実行手順3.5・待機票・ledger.lockの適用はC2bへ移す。本書の単一実行者フローがC2aで使う手順である。旧通知/receipt節の重複は本書の「完了receipt」へまとめる。仕様・決定・全Scenarioを削る操作ではなく、実装する契約と失効した手順の併記を解消する。旧19回答・2仮定と通知補足の回答はtraceに保持し、後続の最終規範と区別する。

## ファイルと所有者

| パス | 役割 | C2aの書き手 |
|---|---|---|
| reports/quality/requests.jsonl | 受付・開始・到達状態の追記専用正本 | eval.lockの所有実行者だけ |
| reports/quality/attempts.jsonl | 開始後に失敗した試行の追記専用正本 | 同上 |
| reports/quality/history.jsonl | 評価結果の追記専用正本 | 同上 |
| reports/quality/quality-report.json | history末尾の内容全体と等しい派生索引 | 同上 |
| .loomake/quality/eval.lock | 実行権、自tokenだけを削除 | wx・0o600で作った所有者 |

C2aは待機票とledger.lockを生成しない。ロックと出力先は途中のディレクトリも含め通常ファイル/ディレクトリだけとし、シンボリックリンク・特殊ファイルは2で拒否する。古いロックを時刻やPIDから自動削除しない。台帳の追記は`withLedgerWrite`一箇所へ集約し、自tokenを確認して実行する。C2bでその内部をledger.lockの取得へ拡張する。

## 追記するデータ

### 3.2 requests.jsonl のイベント（1行1イベント、`version:1`）

```json
{"version":1,"event":"accepted","requestId":"<uuid>","at":"2026-11-05T01:00:00.000Z","source":"manual-cli","target":{"commit":"<sha>"},"basis":{"qualitySha256":"<hex>"},"pid":1234}
{"version":1,"event":"started","requestId":"<uuid>","at":"…","runId":"<uuid>","attempt":1}
{"version":1,"event":"evaluated","requestId":"<uuid>","at":"…","runId":"<uuid>","attempt":1}
{"version":1,"event":"failed","requestId":"<uuid>","at":"…","runId":"<uuid>","attempt":2,"failure":"timeout"}
{"version":1,"event":"cancelled","requestId":"<uuid>","at":"…","phase":"waiting","signal":"SIGINT"}
{"version":1,"event":"abandoned","requestId":"<uuid>","at":"…","phase":"waiting|running","detectedBy":"<requestId>"}
{"version":1,"event":"reevaluated","requestId":"<uuid>","at":"…","runId":"<新runId>","attempt":3}
{"version":1,"event":"unrecoverable","requestId":"<uuid>","at":"…","reason":"head-changed|basis-changed"}
```

**状態の導出**（純粋関数 `foldRequests`）：

| 最後のイベント | 状態 |
|---|---|
| accepted | 待機中 |
| started | 実行中 |
| evaluated・reevaluated | **評価済み**（reevaluated は「再評価で解消」と表示する） |
| failed・abandoned | **再評価待ち** |
| cancelled | **取消** |
| unrecoverable | **回収不能** |

- **重複の拒否**（2 で止めて何も書かない）：
  - accepted が同じ requestId で2回ある
  - 同じ requestId に終端イベントが2つある
  - started の (runId, attempt) が重複している
  - accepted より前に別のイベントがある
- `at` は表示と監査のためだけに使います。順序は行の順で決め、時刻の大小では判定しません。

### 3.3 attempts.jsonl（FR-47）

```json
{"version":1,"runId":"<uuid>","attempt":2,"requestId":"<uuid>","target":{"commit":"<sha>"},"basis":{"qualitySha256":"<hex>"},"startedAt":"…","endedAt":"…|null","detectedAt":"…","result":"failed","failure":"dirty|changed|timeout|interrupted|launch|save|crashed","summary":"reports/quality/requests.jsonl#<requestId>"}
```

- 対象は、started を書いたあと（runId が付いたあと）に履歴へ行を残せなかった試行だけです。待機中の取消は試行ではないので書きません。
- 「未解決か」はファイルに書きません。後ろの history に同じ commit と qualitySha256 の行がなければ未解決です。
- 失敗は判定（verdict）に影響させません。過去に失敗があっても、直したあとの合格は妨げません。
- (runId, attempt) は attempts の中で一意、かつ history と重複してはいけません。違反は 2 です。
- 番号の付け方：`attempt = 同じ target.commit の history 行数 ＋ attempts 行数 ＋ 1`。採番は eval.lock を持つ実行者だけが行います。

### 3.4 history の行に足す項目（core スキーマは不変、looseObject の未知の項目として）

- `request: {id, requestedAt, source}`：その実行自身の要求です。他の要求の時刻は書きません。
- `period: {kind:"utc-day", start:"YYYY-MM-DDT00:00:00.000Z", end:"翌日T00:00:00.000Z"}`：品質コマンドが終わった時刻（observedAt）の UTC 暦日です。
- 索引 `quality-report.json` は、引き続き history の最後の行の中身全体と同じです。同じ条件・同じ期間の再試行では索引だけが選び直され、翌日の評価は別の行として残ります（A22）。複数の代表を持つ索引ファイルは追加しません。


## 状態遷移と不正の拒否

例のイベント形式と4状態は維持する。C2aのacceptedとstartedは1回の追記とfsyncで保存し、待機中の生存管理を作らない。要求順は行順、atは監査と表示に使い、時計の大小で順を変えない。

| 前状態 | 次に認めるイベント |
|---|---|
| 未登録 | acceptedを1回だけ |
| accepted | started、abandoned、unrecoverable |
| started | evaluated、failed、cancelled、abandoned |
| failedまたはabandoned（再評価待ち） | reevaluatedまたはunrecoverableを1回だけ |
| evaluated・reevaluated・cancelled・unrecoverable（真の終端） | 追加イベント不可 |

Q70-25に従いfailed/abandonedを真の終端と混同しない。acceptedより前のイベント、受付/started/失敗イベントの重複、不正な遷移、真の終端の重複を2で拒否する。startedの(runId,attempt)は要求間で一意で、evaluated等の参照は同じ組を正しく参照できる。historyとattempts間の同じ組は重複として拒否する。同runIdでも異なるattemptは組として区別する。再評価は同コミット・同qualitySha256の後の成功を参照し、failed/abandonedの行と元の要求時刻を変えない。手動cancelledは終端で再実行しない。

## C2aのrunEval

1. config・quality.yamlと保存先/lockの種類を検査し、不正なら2で止める。既存のloadConfig・品質読取り・安全入力の境界を使い、新しい設定を加えない。
2. runId/requestIdをUUIDで作り、{runId,requestId,pid,createdAt}を持つeval.lockをwx/0o600で作る。EEXISTなら未受付の3で、台帳・既存lockの内容/mtimeを変えない。実行中か残存かを推測せず、日本語で未受付と手動確認を案内する。
3. requests・attempts・history・索引の改行/JSON/構造/組の一意性を先に検査する。不正なら何も書かず2、自tokenだけを片付ける。履歴にない索引、読めない索引は上書きしない。
4. 自分のattempt採番前に、実行権を持つ者だけが残存要求を回収する。startedに終端がなくhistoryに同runIdがあればevaluatedを補い、historyへ再登録しない。historyになく、同じ組のattemptがすでにあればそのrequestId/対象/基準とstartedの一致を確かめ、分類・時刻・行bytesを保持してabandoned(running)だけを補う。両方に未記録のときだけcrashed（endedAt:null、detectedAt:現在）を新規追記する。不整合な既存参照は先の構造検査で2とし、回収を続けない。acceptedだけならabandoned(waiting)とする。再評価待ちの対象/基準が現在と違えばunrecoverableを追記する。欠落または古い索引はhistory末尾から復旧して評価を続ける。
5. 同コミットのhistory行数+attempts行数+1でattemptを採番する。acceptedとstartedを1回の追記・fsyncで書き、失敗時は自分が加えた部分だけ元の長さに戻して2を返す。
6. 下記許可リストで作業ツリーを検査する。汚れならdirtyとfailedを記録して1を返す。
7. 前回のテストreportと固定coverage-summaryを消し、開始時刻を得てから`runVerify({root,progress,onCommand})`を一度だけ実行する。終了時刻を得て`await setImmediate()`で溜まった信号を処理する。実行順/期限/予算の分岐をtraceへ複製せず、runExternalのInfinity経路を作らない。
8. AbortSignalならinterruptedとcancelled(running)で3。通知のsignal/interrupted/timeoutは対応する分類とfailedで3、error/output/通知欠落はlaunchとfailedで3とし、history/索引を保存しない。HEAD・基準・作業ツリー・帳簿が変わればchangedとfailedで1。すべて数値終了なら下記receipt判定へ進み、正常な検査不合格を起動失敗へ変えない。
9. 保存前に自tokenを確認する。違えばhistory・attempts・索引を変えず3とし、残ったstartedを次の正当な実行者へ残す。history追記/fsyncが失敗したら自分の部分だけftruncateで戻してsaveとfailed、2を返す。戻せなければ不完全な末尾の可能性と手動復旧を案内し、以前の行を変えない。
10. 索引を一時ファイルからrenameする。失敗ならhistoryと古い索引を残して2。成功ならevaluatedと、同条件の再評価待ちへのreevaluated（今回のrunId/attemptと現在時刻）を追記する。
11. finallyで自分と一致するtokenのeval.lockだけを削除する。他tokenはどの終了経路でも残す。判定がFAIL/不足でも保存成功は0、汚れ/実行中変化は1、入力/帳簿/保存不正は2、未受付競合/実行不能/中断/token喪失は3である。

利用者が生存中のlockを手動で消すなど、所有権の確認と追記の間に外部から介入する場合の完全な直列化を保証したとはしない。保存前確認と次実行時の不正拒否を保ち、C2bではledger.lockで通常の台帳書込を直列化する。token喪失側が自分でattemptsを書く補償はしない。

## 作業ツリーとバイト列

`git status --porcelain=v1 -z --untracked-files=all`を使い、自分の正規eval.lockは未追跡だけ、jsonl3本は??/空白MでHEAD版blob（未存在は空）を先頭にそのまま含む追記だけ、最新索引は構造確認済みの??/空白Mだけ許可する。ステージ済み・削除・改名・他パスは1。週次Markdownは帳簿に含めず許可しない。実行前後のrequests/history/attempts/索引をすべて同一bytesで比較する。自動commit/stageを行わない。

Q70-26に従いignore状態は観測の補助である。ignoredならstatusに現れないが、pathの種類とownerを別途検査する。unignoredなら正規own lockの??だけを上の規則で許可する。ignore必須という条件を加えず、.gitignoreを変えない。02ccの「ignoredでなければdirty」はこの採用判断で置き換える。

## 完了receiptと観測

C1の`observeStaticMetrics`と既存kit四値集約を使う。製品品質/利用時品質を分け、blockingUnmetを別のPASSで相殺しない。reportはversion:1、runId/attempt、evaluatedAt/evaluator、target、basis、commands、observations/subjects/summary、request、periodを持ち、coreのloose schemaとtrace検査を併用する。

設定済み全コマンドのexited通知を必要とし、testが正常0または次の条件Eを満たす正常失敗ならreceiptを作る。正常失敗はcommandsのfailedと実際のtests_failedを保持する。lint/typecheckの非0も数値終了の事実を保ち、error_count取得不能は未評価である。

条件Eは実測済みVitest5.0.5に限る。JSON objectのtestResults配列があり、失敗側はsuccess:false。numTotalTests/Passed/Failed/Pending/Todoは安全な整数でassertion件数とすべて一致し、numRuntimeErrorTestSuitesは未指定または0、wasInterrupted:trueを含まない。各ファイルはpassed/failedで1件以上のassertion、各assertionもpassed/failedだけで、skip/pending/todo/未知状態を含まない。今回の実行でproducerと版を照合できることを必要とする。

終了0も完了の証明ではなく、success:false/failed>0/runtime error/interrupted/件数不整合等は上記相当の照合を行い、明示的不完全性を拒否する。通常の整合した成功で意図してskipした試験はC1の規則どおり除外する。P1は同じ3ファイル6試験の通常失敗（成功5/失敗1）とbail1を測り、shell wrapperは両方0だった。bailのpending/空ファイルを拒否できた事実だけで、全hidden bail排除とは言わない。Jestは未導入・未実測で、未知producer/未実測版の失敗を昇格しない。

bail/部分/未確認ならreceipt:null、test/coverageは値なしnot_runのまま、detailだけを「途中で止まった可能性を否定できないため、件数を測定していません（reason）」へ差し替える。C1のstatus/evidence/公開APIを変えない。signal/timeout/interrupted/spawn/output/通知欠落はhistoryを保存せず失敗試行にする。79bの結果だけによる完了推定、4dの「0ならbailなし」は採用しない。

## CLI・信号・互換性

既存cli.tsのgraceful条件をrunまたはtrace evalへ広げ、最初のabortと2回目の即時130/143/129、100ms未満のHUP重複除外を保持する。trace()からsignalを渡す。spawnSync中は親だけへのTERMをコマンド終了後のsetImmediateで処理する制約をガイドに書く。2回目の信号や強制終了ではlockが残り得るため、手動削除後の回収を試験する。REQ-427の既存試験は変更しない。

共通CLI定義へevalを最後に足し、help・候補・不明オプション2・生成referenceを追従する。eval固有のオプションや新設定を作らない。従来trace reportの入力/出力/終了コード/schemaVersion:2とchange必須、既存12Schema、依存の範囲、全旧assert/skip/時間/品質設定を保持する。

## 検証・規模・後続

仕様ゲートのあとtasks順に実装し、REQ名付きの全Scenario試験と通常local完了を通す。非起草Codexと同一依頼の独立Opus、最終headのscope ci通常完了・必須5・trace/cliの通常3 OSを経て受け入れる。計画だけや将来C2bの試験で本PRのSHALLを代用しない。

B0は製品前のmain基準全差分（計画/移管/日誌を含む）を計測し、残り120KB未満なら管理役へ報告して実装しない。B1は2.2完了時に残りのsource/試験/fixture/文書を含む投影を計測し、195KB超の見込みなら止める。200KiBを超えないために全差分の省略・バイナリ化・要件/試験の削除をしない。整理するのは置換済み非規範design重複だけで、原本は固定commitへ辿れる。
