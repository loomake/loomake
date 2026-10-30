# Design: bound-engine-timer-and-interrupt

## エンジンの期限の待機（REQ-336）

監視役（`packages/kit/supervisor/supervisor.cjs` の watchDeadline）と同じ形にする。runClaude は呼ばれた時点の単調時計に timeoutMs を足して期限を持ち、`min(残り, 2147483647)` だけ待つ。発火したら残り時間を計り直し、残っていれば待ち直し、尽きたら既存の停止処理を呼ぶ。最初の待機は従来どおり setTimeout で始め、同期で停止しない。通常の終了・中断・出力超過では、そのとき有効なタイマーを解除する。

`run.timeoutMinutes` に上限を置く案は採らない。今まで受け付けていた値を拒むことになり（REQ-141 の変更）、runClaude を直接呼んだときの丸めも残るためである。

24 日を超える実時間の待機は試験しない。分けた待機が早く発火する状況を setTimeout の差し替えで作り、待ち直すことと、各待機が上限以下であることを確かめる（kit の `process-long-deadline.test.ts` と同じ手法）。

## 中断の写し方（REQ-337）

`ProcessLimitError` の kind が interrupted で reason がないものを、利用者の信号による中断とする。reason の有無で区別するのは REQ-250 の決まりである。判定は `run/phases.ts` の `interruptedOperation` にまとめ、`run.ts` の実行中の失敗の catch と、`recordAndOpenPr` の push・PR の catch で、状態だけを選ぶ。理由の文は変えない。

信号を受けたかどうかを AbortSignal で確かめる案は採らない。監視役だけが信号を受けた場合を取りこぼし、試験もイベントループの順序に依存するためである。

SIGHUP を監視役で扱うのは別の change（`stop-command-group-on-sighup`）の範囲とする。この change は kind と reason だけを見るので、その change で SIGHUP による中断が reason なしで返れば、同じく interrupted に写る。

## 試験

監視役へ信号を送るため、git のフック（pre-commit・pre-push）から祖先の監視役を探して信号を送るスクリプトを使う（`external-budget.test.ts` の REQ-183・REQ-250 の試験と同じもの。helpers に移して共有する）。Windows では、別のプロセスから送る SIGINT は監視役の強制終了になるので、REQ-337 の統合試験は POSIX だけで行う。

## 目的・範囲・対象外・前提

**目的**
- O1：`run.timeoutMinutes` が Node のタイマーの上限（2147483647ms ≒ 35,791.4 分）を超えても、エンジンをすぐ時間切れにしないようにする。
- O2：git・gh の実行中に監視役が SIGINT・SIGTERM で操作を止めたとき、summary.json の状態を `interrupted` にする。いまは `stopped` になっている。

**範囲**
- `packages/runner/src/engine.ts`：期限のタイマーを分ける。
- `packages/runner/src/run.ts`：実行中の失敗を `interrupted` に写す。
- `packages/runner/src/run/phases.ts`：push・PR の catch も同じく写す。依頼の範囲の外だが、同じ原因なので含める（Q-04）。
- 上の 2 点の回帰テスト、差分仕様、Scenario のレビュー、changeset、run の復旧の説明に 1 文。

**対象外**
- `packages/kit/supervisor/supervisor.cjs` と `packages/kit/src/runtime/process.ts`（SIGHUP の扱い。別の change `stop-command-group-on-sighup` の担当）。
- `config.ts` の `timeoutMinutes` の上限。おすすめの案では変えない（Q-01）。
- 約 1.8e303 分を超えて `timeoutMinutes*60000` が Infinity になるときの文言。いまも UsageError（終了コード 2）になっているので、Issue に回す（Q-06）。
- 準備中（記録を作る前）の中断。REQ-182 のとおり終了コード 3 のまま。
- 品質コマンドが理由つきの中断（監視役の異常終了）で終わったあとに、直しへ進む既存の経路。`phases.ts:117` は `INTERRUPTED` と完全に一致するときだけを中断とみなすため。Issue に回す。
- コミット中に中断したとき、tasks.md の完了印が作業ツリーに残る既存の挙動（`phases.ts:67` の印は commit より前に付く）。

**前提**
- 端末の Ctrl-C は前面のプロセスグループに届くので、監視役（spawnSync の子で、親と同じグループ）も受ける。対象のコマンドは `detached` で別グループなので受けない（`supervisor.cjs:134`）。
- 利用者の中断と監視役の異常終了は、`ProcessLimitError.reason` があるかどうかで区別する（REQ-250、`external-process-budget/spec.md:48`）。

行番号は、設計時点の origin/main（d5aa30d）のもの。

## 観測事実と原因

### O1：タイマーの丸め
- `engine.ts:130-133`：`setTimeout(…, Math.max(call.timeoutMs, 0))` に上限を超える値を渡すと、Node は 1ms に丸めて `TimeoutOverflowWarning` を出す。そのため `timedOut = true` になり、`stop()` の 250ms の猶予のあとに止まる（`engine.ts:88-92`）。再現スクリプトの `.loomake/repro/timer-overflow.mjs:3`（`timeoutMs: 2_147_483_648`）と同じ結果である。
- 値の出どころ：
  - `config.ts:27-28` は `timeoutMinutes` を正の有限数なら受け付ける。
  - `run.ts:23` は `withProcessBudget({ timeoutMs: timeoutMinutes*60_000 })` を作る。
  - `recorder.ts:18` は `base = startedAt + timeoutMinutes*60_000` である。
  - `phases.ts:23,33` は `Math.min(rec.deadline - now, remainingProcessTime())` をそのまま `runClaude` に渡す。
- 監視役は分けて待っている（`supervisor.cjs:80-88`：`Math.min(remaining, 2_147_483_647)`、発火のたびに計り直す）。kit 側の仕様（`external-process-budget/spec.md:29-31`）とテスト（`packages/kit/test/process-long-deadline.test.ts`）もあるが、エンジン側だけが未対応である。

### O2：中断が `stopped` になる
- `git.ts:17` と `pr.ts:10,67,82` は `runExternal` を呼ぶ。監視役が SIGINT・SIGTERM を受けると `stop('interrupted')` になり（`supervisor.cjs:90-91`）、`process.ts:450-452` が `ProcessLimitError('interrupted')` を投げる。これは `RuntimeFailure` で、`GitError` ではない（`process.ts:42`）。
- `run.ts:70-76`：`RuntimeFailure` をまとめて `rec.finish('stopped', e.message, remaining)` にしている。decision-policy を通らない。
- `phases.ts:179-192`：push・PR の検索・PR の作成の catch も、まとめて `'stopped'` にしている。push 中の中断はここを通るので、run.ts だけを直しても残る。
- これは仕様と合っていない。REQ-124（`run/spec.md:246-257`、中断した旨の summary.json）と REQ-208（`run/spec.md:506-525`、git のような同期の処理のあいだの中断も中断として扱う。Scenario の状態は interrupted）である。
- 既存のテストで見つからなかった理由：`signal-during-sync.test.ts:13-37` は AbortController だけで中断をまねていて、監視役は信号を受けない。そのため `ProcessLimitError` の経路を通らない。
- 理由つきの中断（`process.ts:388-394` の `missingResultError`。監視役が結果を書かずに終わった）は、REQ-250 で「利用者の中断と区別する」と定められている。こちらは `stopped` のまま残すのが仕様に合う。

## 修正方針の比較

### O1：エンジンのタイマー

| 案 | 内容 | 評価 |
|---|---|---|
| **A（おすすめ・採用）** | 監視役と同じ形にする。単調時計で期限を持ち、`min(残り, 2147483647)` ずつ待ち、発火のたびに計り直す | 原因そのものを直せる。設定の互換が保たれ、REQ-141 も変えずに済む。既存の kit 側の作りと対になる |
| B | `parseRunConfig` で `timeoutMinutes ≤ 35791` に制限し、超えたら UsageError にする | 今まで受け付けていた値を拒むので、仕様（REQ-141）を変えることになり、人の承認が要る。runClaude を直接呼んだときの丸めも残る |
| A＋B | 両方 | 上限を置く理由がなくなるので、B は要らない |

案 A のコードの形（`engine.ts:130-133` を置き換え）：
```ts
const MAX_TIMER_MS = 2_147_483_647; // これを超えると Node は 1ms に丸める
const monotonicMs = () => Number(process.hrtime.bigint()) / 1_000_000;
const deadline = monotonicMs() + Math.max(call.timeoutMs, 0);
let timer: NodeJS.Timeout;
const watchDeadline = () => {
  const left = deadline - monotonicMs();
  if (!(left > 0)) { timedOut = true; stopping ??= stop(child); return; }
  timer = setTimeout(watchDeadline, Math.min(left, MAX_TIMER_MS));
};
timer = setTimeout(watchDeadline, Math.min(Math.max(call.timeoutMs, 0), MAX_TIMER_MS));
```
- 最初の発火は従来どおり非同期にする。`finishMonitoring`（`engine.ts:139-142`）の `clearTimeout(timer)` は、そのとき有効なタイマーを解除する。
- `!(left > 0)` にしているので、NaN が来ても従来と同じくすぐ時間切れになる。

### O2：中断の写し方

採用するのは、`ProcessLimitError` の `kind === 'interrupted'` で、かつ `reason === undefined` のときだけ `interrupted` に写す案である。
- `phases.ts` に小さな判定 `interruptedOperation(e)` を export する。run.ts はすでに phases から import しているので、循環しない。
- `run.ts:75` と `phases.ts:191` の 2 か所で、状態だけをこの判定で選ぶ。理由の文は今のまま変えない。push のときの「証拠のコミットを保っていますが…」も残る（A-02）。

比べた案：
- 「catch で `setImmediate` を待ってから `signal.aborted` を見る」案は、監視役だけが信号を受けた場合に取りこぼす。テストもイベントループの順序に依存してしまうので、採らない。
- decision-policy に入れる案は、REQ-206 の直接試験の対象が増えるだけで得るものがないので、採らない。

**SIGHUP の change（`stop-command-group-on-sighup`）との境界**：その change は supervisor と process.ts で、SIGHUP を `stop('interrupted')` に足す担当である。こちらは `kind` と `reason` だけを見るので、その change がマージされれば SIGHUP も自動で `interrupted` に写る。条件は、その change が利用者の信号の中断に `reason` を付けないことである（Q-05）。

### 1 つの change にする

1 つの change・1 つの PR とする（Q-03）。どちらも run の capability と runner パッケージの中で閉じていて、「run の期限と中断の記録のずれ」という同じ主題である。commit も 6〜8 個で、1 日でマージできる大きさに収まる。tasks.md は 2 と 3 に分けるので、必要ならその境目で PR を分けられる。

## 受入条件と確認方法

| ID | 受入条件 | 確認方法（修正前に失敗→修正後に成功） |
|---|---|---|
| AC-1 | `runClaude` に上限を超える `timeoutMs` を渡しても、時間内に終えたエンジンを時間切れにせず、`TimeoutOverflowWarning` も出さない | `[REQ-336] タイマーの上限を超える時間の上限でも、時間内に終えたエンジンの結果を保つ`：偽の claude が 300ms 後に `{"result":"完了"}` を出して 0 で終わる。`timeoutMs: 2_147_483_647 + 60_000`。`timedOut:false`、`exitCode:0`、`text:'完了'`、`process.on('warning')` で警告が 0 件。修正前は `timedOut:true` で失敗 |
| AC-2 | 分けた待機が早く発火しても、計り直して待ち直す | `[REQ-336] 分割した待機が期限前に発火しても、残り時間を確かめて待ち直す`：`vi.spyOn(globalThis,'setTimeout')` で ms>1000 の待機を記録し、最初の 2 回は 1ms で発火させる（kit の `process-long-deadline.test.ts:19-47` と同じ手法）。`timedOut:false`、待機は 3 回で、どれも `0 < ms ≤ 2147483647`。修正前は 1 回だけで、ms が上限を超えるので失敗 |
| AC-3 | `run.timeoutMinutes: 40000` でも run が完了する | `[REQ-336] run.timeoutMinutes がタイマーの上限を超えても、エンジンをすぐに時間切れにしない`：`makeRepo({ run:{ timeoutMinutes: 40_000 } })`、`plan([{ write:{'impl.txt':'実装\n'}, sleepMs: 500 }, {}])`。終了コード 0、`status:'completed'`、出力に「実行時間の上限」がない。修正前は `stopped`「実行時間の上限に達しました」で失敗 |
| AC-4 | タスクのコミットの git のあいだに監視役が SIGINT を受けたら、状態は `interrupted`、終了コード 1、エンジンは再び呼ばない | `[REQ-337] タスクのコミットの git のあいだに監視役が中断を受けたら、summary.json の状態を interrupted にする`（POSIX のみ）：pre-commit のフックが祖先の監視役へ SIGINT を送る。`status:'interrupted'`、`doneTasks:[]`、`remainingTasks[0]` が 1.1、`repo.calls()` が 1 件、`impl.txt` が作業ツリーに残る、PR は 0 件。修正前は `stopped` で失敗 |
| AC-5 | push のあいだの中断も `interrupted` で、証拠のコミットを保つ | `[REQ-337] 証拠の push のあいだに監視役が中断を受けたら、証拠のコミットを保ち interrupted にする`：pre-push のフックで SIGINT を送る。`status:'interrupted'`、`reason` に「証拠のコミットを保っています」、最新のコミットが `evidence(c1):`、`ls-remote --heads` が空、PR は 0 件。修正前は `stopped` で失敗 |
| AC-6 | 理由つきの中断（監視役が結果を書かずに終わる）は `stopped` のまま | `[REQ-337] 監視役が結果を書かずに終わったときは、利用者の中断と区別して stopped のままにする`：pre-commit のフックで監視役へ SIGKILL を送る。`status:'stopped'`、`reason` に「監視役が結果を書かずに終了しました」。修正の前後とも成功する（写し方を広げすぎていないことの見張り） |
| AC-7 | 既存の期限・中断のテストが変わらず通る | `engine-safety`（REQ-139、timeoutMs 500）、`engine-normal-exit`、`run.test` の REQ-105・REQ-124・REQ-137、`signal-during-sync`、`external-budget` |

修正前の失敗は、テストを入れたコミットで実装前に実行し、結果を PR に記録する。

## 変更対象

| ファイル | 変えること |
|---|---|
| `packages/runner/src/engine.ts` | 期限のタイマーを分けて待つ形にする（130-133 行を置き換え）。`MAX_TIMER_MS` と単調時計を足す |
| `packages/runner/src/run/phases.ts` | `interruptedOperation(e)` を export する。`recordAndOpenPr` の catch（191 行）で状態を選ぶ。`ProcessLimitError` を `@loomake/kit` から import する |
| `packages/runner/src/run.ts` | catch（75 行）で `interruptedOperation(e) ? 'interrupted' : 'stopped'` にする |
| `packages/runner/src/config.ts` | 変更なし（案 A） |
| `packages/runner/test/engine-long-deadline.test.ts`（新規） | AC-1〜AC-3。kit の `process-long-deadline.test.ts` と対にする |
| `packages/runner/test/helpers.ts` | `external-budget.test.ts:269-298` の「祖先の監視役へ信号を送るスクリプト」を、信号を引数に取る形で export する。結果の JSON はスクリプトの置き場所（`repo.base`）に書き、作業ツリーを汚さない |
| `packages/runner/test/external-budget.test.ts` | 上のスクリプトを helpers から使う。期待値は変えない |
| `packages/runner/test/signal-during-sync.test.ts` | AC-4〜AC-6 の describe を足す（`it.runIf(process.platform !== 'win32')`） |
| `docs/guide/2.guides/3.run-recovery.md` | 100 行目の節「端末を閉じたときとコンテナを止めたとき」に、git・gh の実行中の中断も summary.json の状態が interrupted になると 1 文足す（yomiyasu で推敲） |
| `docs/quality/scenarios.json` | この change の Scenario のレビューを足す。根拠にするテストファイルが変わった既存のレビューは、読み直してハッシュを更新する |
| `.changeset/*.md` | `@loomake/runner` と `loomake` の patch |

## 設計工程の記録

- 実行ツール：Claude Code 2.1.308（`.agents/skills/delivery/scripts/ask-opus.mjs` 経由）
- セッション：`380d4efd-8a0c-4224-b255-3283edbb838a`（`.loomake/claude/380d4efd-8a0c-4224-b255-3283edbb838a/`）
- `events.jsonl` の assistant のモデル：`claude-opus-5-5`（56 ターン）
- `manifest.json` の modelUsage には `claude-haiku-5-5`（補助の呼び出し）も含まれていたため、スクリプトは `ok: false`（Opus 工程は未実施）を返した
- 工程の状態：人の判断待ち。Opus 工程を実施済みとは扱わない
