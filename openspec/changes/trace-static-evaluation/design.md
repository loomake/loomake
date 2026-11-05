# Design

## C2の境界

C1はPR #440・#441で受入済みの公開observeStaticMetricsを再利用する。C3のstatusはc3-transfer.mdへ原文を移し未実装とする。本changeはevalと手動FIFO・全要求追跡だけを所有する。

## Context

Issue #70は既存品質コマンドの値だけを手動で評価する。追加の利用者決定により、手動3CLIの実行中1件と待機2件以上、全要求追跡、FR-47の失敗試行、A22の別試行・翌期間保持も本作業が担当する。固定WBSと公開8JSONは変えない。

## Goals / Non-Goals

静的観測、手動評価、要求台帳とFIFO、失敗試行、履歴と索引、保存済み判定からのstatusを3本の通常子changeで実装する。定期起動とActions一覧の照合、外部測定、未計測件数の推定、daemon、新しいevalオプションは含めない。

## Decisions

初回463f483a・補足e7dfacf6・追加79b4d2aaのok:true/実Opus5-5の設計を採用する。追加設計はf78aed5cを対象とした。Q70-05R・09〜17・19は管理役がADR0006に従って推奨Aを採用した。静的観測はC1の公開関数を再利用し、error_countを終了コードで代えない。


### 3.1 ファイルと役割

| パス | Git | 書く人 | 役割 |
|---|---|---|---|
| `reports/quality/requests.jsonl` | 正本（追記専用） | 全要求（ledger.lock の下で） | 要求のイベント台帳 |
| `reports/quality/attempts.jsonl` | 正本（追記専用） | eval.lock を持つ実行者だけ | FR-47 の失敗試行 |
| `reports/quality/history.jsonl` | 正本（追記専用） | eval.lock を持つ実行者だけ | 評価済みの行（既存の契約） |
| `reports/quality/quality-report.json` | 派生（索引） | eval.lock を持つ実行者だけ | history の最後の行（既存の契約） |
| `.loomake/quality/eval.lock` | 対象外 | 実行者 | 実行権。token は `{runId, requestId, pid, createdAt}` |
| `.loomake/quality/ledger.lock` | 対象外 | 誰でも（数 ms だけ持つ） | requests の読み書きと jsonl への追記の排他 |
| `.loomake/quality/queue/<requestId>.json` | 対象外 | その要求自身だけ | 待機票。中身は `{requestId, pid, createdAt}`、生存は mtime で示す |

ロックと待機票は、どれも `wx`・0o600 で作ります。途中のディレクトリを含め、シンボリックリンクや特殊ファイルは 2 にします。これは既存の `publication.ts:16-19` と同じ確かめ方です。

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

### 3.5 処理の流れ（`runEval(options): Promise<number>`）

1. **事前検査**（ロックは取らない）：config・quality.yaml（不正なら 2）、保存先とロックのパスの種類（2）。
2. **要求の登録**：
   - 待機票を `wx` で作ります。台帳に載る前に作ることで、「票のない要求」が生まれないようにします。
   - ledger.lock を取り、4ファイルを構造検査します（不正なら 2 で何も書かない。作った待機票は消す）。
   - accepted を追記して、ledger.lock を解放します。
   - stderr に `評価要求 <id> を受け付けました（対象 <sha12>）。前に N 件あります。Ctrl+C で取り消せます。` と出します。
3. **待機ループ**（200ms ごと。待機票の mtime を 1 秒ごとに `utimesSync` で更新。時間上限なし）：
   - ledger.lock の下で台帳を読み、自分より前に「待機中で、待機票が新しい（15 秒以内）」要求がなく、eval.lock もなければ、`wx` で eval.lock を取ります。
   - 取れたら台帳を読み直します。
     - 自分に終端イベント（abandoned）が付いていれば、eval.lock を返して 3。
     - 自分より前に生きている待機者がまたいれば、eval.lock を返して待機を続けます。
4. **回収**（eval.lock を持つ実行者だけが行う。他人のファイルは消さない）。自分以外の、終端していない要求を分類します。
   - **実行中のまま止まった要求**：
     - history にその runId があれば、`evaluated` を後から追記します（history には二重に入れない。A22 の二重取り込み防止）。
     - history になければ、attempts に `crashed` の行（endedAt は null、detectedAt は現在時刻）を書き、`abandoned(phase:running)` を追記します。
   - **待機中の要求**で、待機票がないか 15 秒以上古いもの：`abandoned(phase:waiting)` を追記します。
   - **再評価待ちの要求**で、commit が現在の HEAD と違うか、qualitySha が現在の値と違うもの：`unrecoverable`（理由つき）を追記します。
   - 索引が古い、または欠けているとき（以前の S2）は、末尾から索引を作り直し、**評価を続けます**（Q70-15）。出どころの分からない索引（S3）は 2 です。
5. **自分の要求の対象を確かめる**：
   - HEAD が自分の `accepted.target.commit` と違えば、`unrecoverable(head-changed)` を書いて **1**。
   - qualitySha が違えば、`unrecoverable(basis-changed)` で 1。
6. started（runId と attempt を採番）を追記し、eval.lock の token に runId を書き込みます。
7. **作業ツリーの検査**（3.6 の許可リスト）。汚れていれば attempts に `dirty`、requests に `failed` を書いて 1。
8. テストのレポートとカバレッジを消してから `runVerify({root})` を実行します。その直後に `await setImmediate`（`node:timers/promises`）で、溜まっていた信号の処理を走らせます。
9. **事後の検査**：
   - 中断（`signal.aborted`）なら `interrupted`、その要求は `cancelled(phase:running)` にして **3**。
   - 時間切れ・起動失敗なら `timeout` か `launch`、`failed` にして 3。
   - HEAD・基準・作業ツリー・帳簿のバイト列が変わっていれば `changed`、`failed` にして 1。
   - どの場合も history には書きません。
10. **保存**：
    - eval.lock の token が自分のものであることを確かめます。違えばhistory・attempts・索引を変えず3を返します。未完startedは次の正当な実行者が回収します。
    - ledger.lock の下で history に追記し、fsync します。失敗したら自分の分だけ ftruncate で戻し、`save` の失敗にして 2。
    - 索引を tmp ファイルから rename で置き換えます。失敗したら 2 にし、history はそのまま残します（次の実行で復旧）。
    - `evaluated` を追記します。同じ commit と qualitySha の再評価待ちの要求それぞれに、`reevaluated`（今回の runId・attempt、時刻は現在）を追記します。
11. **finally**：token が一致する eval.lock だけを消します（既存の 2.2 の手順）。自分の待機票は無条件に消します。0 を返します。

**終了コード**

| 状況 | 終了コード |
|---|---|
| 成功（判定が FAIL でも保存できれば） | 0 |
| 作業ツリーの汚れ・実行中の変化・待機中の HEAD の変化 | 1 |
| 入力や帳簿の不正・保存の失敗 | 2 |
| 中断・時間切れ・起動失敗・待機の途切れ・ロックの置き換え・ledger.lock が 10 秒取れない | 3 |

### 3.6 作業ツリー検査の厳密な許可リスト（REQ-442）

`git status --porcelain=v1 -z --untracked-files=all` の各項目について、次のどれかに当たるときだけ許可します。

- `.loomake/quality/eval.lock`、`.loomake/quality/ledger.lock`、`.loomake/quality/queue/<uuid>.json`。XY が `??` のときだけ。
- `reports/quality/{requests,attempts,history}.jsonl`。XY が `??` か ` M`（ステージしていない）で、HEAD の blob（なければ空）が作業ツリーの版のバイト列の先頭に一致するときだけ。
- `reports/quality/quality-report.json`。XY が `??` か ` M` のときだけ。中身は手順 4 の索引の検査で別に確かめます。
- これ以外の変更、ステージ済みの変更、名前の変更や削除は、すべて汚れです。

**実行中の不変条件**（手順 8 の前後で比べる）：

- history・attempts・report の SHA-256 が同じ。
- requests は、前のバイト列が後のバイト列の先頭に一致し、増えた分が自分以外の requestId の正しいイベントだけ。
- 自動の `git commit` はしません（Q70-16）。

`reports/quality/<週>.md`（status の出力）は許可しません。これは帳簿ではないためで、既存の契約のままです。

### 3.7 信号処理（受入済み main の `cli.ts` に接続する）

`.loomake/w1-11-accepted-main-cli.ts:9` の条件を `run` または `trace eval` に広げます。

```ts
const graceful = process.argv[2] === 'run' || (process.argv[2] === 'trace' && process.argv[3] === 'eval');
if (graceful) { …既存の処理は1文字も変えない… }
```

- 1回目の信号は `controller.abort()`、2回目はすぐに `process.exit(130/143/129)` です。最初の HUP から 100ms 未満の HUP を数えない処理（REQ-427）も変えません。`main.ts` の `trace()` から `runEval({ …, signal: io.signal })` を呼びます。
- **待機中**はイベントループが動いているので、1回目の信号ですぐに `cancelled(phase:waiting, signal)` を書き、待機票を消して **3** を返します。2回目の信号でそのまま終わった場合は台帳に何も残りません。次の実行者がこれを `abandoned` として再評価待ちに回収します。
- **実行中**は `spawnSync` で止まっています。
  - 端末の Ctrl+C はプロセスグループ全体に届くので、子のコマンドが止まり、手順 8 のあとで abort に気づいて `interrupted` と取消になります。
  - 親のプロセスだけに SIGTERM を送った場合は、コマンドが終わったあとで取消として扱い、保存しません。これは制約として利用ガイドに書きます。
  - 信号が2回たまっていた場合は、すぐに終了して eval.lock が残ります。これは「クラッシュ」と同じ扱いで、手動で消してから回収します。
- **kill -9**：
  - 待機中なら、待機票が古くなるので次の実行者が `abandoned` にします。
  - 実行中なら eval.lock が残ります。待機者には「`<path>` があるので待っています。止まった実行の残りなら消してください」とだけ出し、自動では消しません。

---

## 所有権と要求追跡の補正

設計3.5の手順10より、自token喪失時はattemptsも書込禁止とする。history・attempts・索引を変えず3を返し、要求イベントはledger.lock下でのみ書く。残ったstartedから次の正当な実行者がcrashedを回収する。ledger.lock自体も自tokenだけを片付け、10秒取得不能なら他tokenのファイルを残して3を返し手動確認を案内する。accepted前は未受付、accepted後は既存イベントが正本であり、次の実行者が待機票の途絶えまたは実行権不在から放棄を回収する。正常完了に扱わない。

## 分割と移管

C1 add-quality-static-observationはREQ-430、C2 trace-static-evaluationはevalと全要求追跡（429・431〜434・437〜438 eval・439〜442・323 eval）、C3 add-quality-status-reportは435・436と437・438・323のstatus追加を所有する。各子は通常DoD・CI・独立レビューを満たす。C1archive後に430を親deltaから外して既存仕様で充足へ変更する。C2を実装する前にstatusの全文と未完タスクをC3へ移し、C3はC2受入済み全文をMODIFIEDする。現在のstatus本文と未完タスクは移管前の保存で、C1のPRへ持ち込まない。

## Risks / Trade-offs

- heartbeatが15秒途絶えた一時停止プロセスは、放棄として記録されたあと復帰しても3で止まる。
- killによる残存eval.lock/ledger.lockは自動削除せず手動確認を必要とする。未完要求は台帳から次の実行者が回収する。
- history追記後に索引だけ失敗したらhistoryを保持して2を返す。次evalは索引を復旧して当該要求の評価を続ける。
- 帳簿の不完全な末尾は2で止め、過去行を自動修正しない。
- 同条件の後の成功は失敗attemptより大きいattemptから導き、失敗行を消さない。

## Migration Plan

C1は受入とarchive済み。C2仕様ゲート成功後に実装し、C2受入後にC3を進める。CLIが増えるC2でREQ-323と生成リファレンスも追従する。A20手動・FR47・A22はC2で実観測し、定期起動とActions照合は後段に残す。各子の完了は#70全体完了ではない。

## 評価の構造と完了receipt

reportはversion:1、runId、attempt、evaluatedAt、evaluator{name,version}、target{commit,committedAt}、basis{qualitySha256,qualityVersion,model}、commands{name,result}、observations（source・evidence・observedAt）、subjects（id・kind・特性・blocking・四値結果・理由）、summary{product,usage,blockingUnmet}、request{id,requestedAt,source}、periodを持つ。coreの既存loose schemaとtraceの構造検査を併用する。

C1のStaticMetricReceiptは完了済みの品質実行からだけ作る。command failedが正常終了の検査未達なら測定可だが、timeout/interruption/spawnfailure/bail等はnullにし、部分的な新しいレポートを採用しない。実際の収集側の失敗注入試験でこの前提を確認する。runVerifyは同期実行のため、直後のsetImmediateで信号を処理してから保存の可否を決める。

## PR規模と検証

C2は採用済み設計の140〜175KB見込みを基礎に、計画と実装・境界試験を含め200KiB以内の通常PRとする。要件・試験・DoDを削らず、超過が見込まれれば管理役へ分割を提案する。C3の原文保存は製品のstatus実装を含まない。既存の公開JSON、品質設定、assert・skip・期限は変更しない。

## 実装前に見つかった完了判定の確認事項

Q70-20は未回答であり、製品実装を止める。現行runVerifyのcommand checkは、spawnSyncのstatus:nullを通常の非0終了と同じFAILに畳む場合があり、返されたcompletedだけでは実行完了を裏づけられない。またbailと正常な検査未達の区別は通常の終了コードだけではできない。C1の未完了receipt=null契約を守るため、既存verifyへ完了通知を足すか、C2収集側が公開runExternalのstatus/signal/errorを取得して完了を照合するかを管理役へ提示した。未決の案を採用済み設計へ読み替えない。
