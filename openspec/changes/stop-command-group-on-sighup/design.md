# Design: stop-command-group-on-sighup

## Context

HEAD（d5aa30d）のコードは、設計の依頼の前提と 2 点違う。

- **親の側はもう直っている。** `UsageError('外部操作の監視結果を読み取れません')` は、archive 済みの change `2026-10-28-stop-children-when-supervisor-dies` で除かれた（同 proposal.md:7）。HEAD の `process.ts:439-447` では、監視役が結果を書かずに終わると、親がプロセスグループを止めて `ProcessLimitError('interrupted', 理由)` を返す。
- **孤児が実際に残るのは、親と監視役が同時に死ぬ経路である。** `loomake verify` などの run 以外のサブコマンドを動かしている端末を閉じたときが、これに当たる。

このため、変えるのは監視役（supervisor.cjs）だけにする。親（process.ts）と runner は変えない。

### 目的

- POSIX で監視役に SIGHUP が届いたら、SIGINT・SIGTERM と同じく、対象のプロセスグループを止めてから中断を返す。親が先に死んでいても止める。
- 監視役が停止の手順を終えずに終わる別の経路（未処理の例外など）でも、対象を残さない。

### 範囲

- `packages/kit/supervisor/supervisor.cjs` に、SIGHUP のハンドラと exit 時の SIGKILL を足す（POSIX だけ）
- 回帰テスト
- 復旧の文書の記述を実態に合わせる
- changeset と scenarios.json の更新

### 対象外

- 親の側の扱い（process.ts）。REQ-250 で対応済み。
- run の summary の判定（phases.ts・run.ts）。REQ-208 の CLI のハンドラで interrupted になる。
- Windows のコンソールを閉じたとき（Q-03）
- 監視役が SIGKILL・OOM で死んだときの run の status（Q-02）
- `kill <CLIのPID>` のように、CLI だけに届いた信号で、実行中のコマンドを即座に止めること

### 前提

- POSIX では、端末を閉じたときの SIGHUP は、CLI と監視役がいるフォアグラウンドのプロセスグループに届く。監視役は spawnSync で起動するので、CLI と同じグループである。
- 対象は `detached` で別のグループにいるので、SIGHUP は届かない（supervisor.cjs:134）。

### 不明点

| ID | 内容 | ブロッキング |
|---|---|---|
| Q-01 | 再現の結果が HEAD のビルドによるものか分からない | いいえ。Red はタスク 1 のテストで示す |
| Q-02 | 監視役だけが異常終了したときの run の status | いいえ。範囲外で、Issue に回す |
| Q-03 | Windows で SIGHUP のハンドラを登録するか | いいえ。おすすめは POSIX だけ |

詳細と回答は trace.md の確認事項を参照。

## 観測事実と原因

### コードで確かめた事実（HEAD d5aa30d）

- `supervisor.cjs:90-91`：捕まえているのは SIGINT・SIGTERM だけ。SIGHUP を受けると、監視役は既定の動作で即座に死ぬ。
- `supervisor.cjs:134`：対象は `detached: !win` で起動するので、POSIX では別のプロセスグループである。監視役が死んでも、対象には何も届かない。
- `process.ts:439-447`：結果（outcome）がないときは、`stopTree` が `-pid` に SIGTERM を送り、250ms 後に SIGKILL を送る（:377-380）。そのあと `missingResultError` が `ProcessLimitError('interrupted', '監視役が結果を書かずに終了しました（シグナル SIGHUP）')` を投げる。依頼にある「80〜90 行の UsageError」は HEAD にはない。
- `cli.ts:8`：SIGINT・SIGTERM・SIGHUP のハンドラを登録するのは `run` のときだけ（`if (process.argv[2] === 'run')`）。
- `verify/run.ts:322`：中断に理由があると、detail は `中断されたので止めました（…）` になる。
- `phases.ts:117`：`r.detail === INTERRUPTED` と完全一致で比べているので、理由つきの detail は中断と見なさない。
- `phases.ts:113`：ただし、その前に `interrupted(ctx)` が abort の信号を見るので、CLI が SIGHUP を受けていれば interrupted になる。
- `run.ts:75`：RuntimeFailure は `stopped` として記録する。

### 再現について（Q-01）

`.loomake/repro/sighup-supervisor.mjs:1` は `/workspaces/loomake/packages/kit/dist/index.js` を読み込んでいる。これは設計時の worktree の外にあるビルドで、読み取りを拒否されたので中身を確かめていない。観測で出た UsageError の文は HEAD のソースにないので、古いビルドで再現した可能性が高い。

HEAD のコードを読む限り、監視役だけに SIGHUP を送る `sighup-driver4.sh` では、親の `stopTree` がグループを止める。孤児は残らない見込みである。

### HEAD で実際に起きること

| 状況 | CLI | 監視役 | 対象 | 結果 |
|---|---|---|---|---|
| `loomake verify` などの実行中に端末を閉じる | SIGHUP で死ぬ（cli.ts:8） | SIGHUP で死ぬ（:90-91） | **残る。後片付けする親がいない** | 孤児になる（本件の本体） |
| `loomake run` の品質コマンド中に端末を閉じる | 生き残り、abort する | SIGHUP で死ぬ | 親の stopTree で止まる | 状態は interrupted。ただし検査の detail が理由つきになり、SIGINT・SIGTERM のときとずれる |
| 監視役だけに SIGHUP を送る（再現） | 生きている | 死ぬ | 親が止める | 理由つきの中断。run では phases.ts:117 で中断と見なされず、後続の git が中断の例外を投げ、`stopped` になる（run.ts:75） |

### 原因

監視役は、SIGINT・SIGTERM のときは対象を止めるが、SIGHUP のときは止めずに死ぬ。親が生きていれば REQ-250 の後片付けで補われる。しかし run 以外のサブコマンドでは、親も同じ SIGHUP で死ぬので、誰も対象を止めない。

## 修正方針

### 案 A（採用）：監視役で SIGHUP を `stop('interrupted')` にする

- `supervisor.cjs:91` の次に `if (!win) process.on('SIGHUP', () => stop('interrupted'));` を足す。
- これで SIGHUP は SIGINT・SIGTERM と同じ経路を通る。親が生きていれば理由のない中断になり、verify の detail は `INTERRUPTED` になる。親が死んでいても、監視役が自分でグループを止める。
- 二度目の信号は、`stopping` で無視される（:63）。

### 案 B（採用）：exit 時に、未停止のグループへ SIGKILL を送る

- `if (!win) process.on('exit', () => { if (child && child.pid && !exited) kill('SIGKILL'); });`
- **塞げる経路**：Node は、未処理の例外で終わるときにも `exit` イベントを出す（仮定 A-03。Red/Green で確かめる）。たとえば、親が死んだあとに `forward` から process.stdout に書いて EPIPE になると、監視役は未処理の例外で終わり、stop を通らない。このとき対象が残る。この経路は、まさに「親が死んだ」場合に起きるので、親の stopTree では補えない。
- **塞げない経路**：SIGKILL や、ハンドラのない信号による終了では、`exit` イベントが出ない。これは親の stopTree（REQ-250）に任せる。
- **二重の kill の副作用**：`!exited` が条件なので、対象の先頭のプロセスを回収する前にだけ送る。回収前は PID N がまだ使われているので、プロセスグループ N はこの監視役のものに限られ、ほかのグループを誤って止めない。
  - 回収してから JS の `exit` コールバックが動くまでの間に、JS は動かない（libuv は waitpid の直後にコールバックを呼ぶ）。
  - 停止の経路で 1 秒待っても exit が来ずに `finish` したときは、もう一度 SIGKILL を送る。グループは監視役のもののままなので、害はない。
  - 正常に終わったときは `exited` が真なので、何も送らない。
- **Windows を除く理由**：検証できないハンドラを足さないという前例に合わせる（stop-children-when-supervisor-dies の Q-01）。

### 採らない案

- **親の側で、`result.signal` があり fd3 が空のときを理由のない中断に写す。** REQ-250 の「利用者の中断とは理由の有無で区別する」に反する。また、案 A のあとは SIGHUP がこの経路を通らなくなるので、変える理由もない。
- **CLI のすべてのサブコマンドで SIGHUP を処理する。** CLI は spawnSync の中で止まっているので、ハンドラは対象が終わるまで動かない。これでは止められない。

### summary.json の status

端末を閉じたときの run は、HEAD でも CLI の abort（REQ-208）で `interrupted` である。案 A によって、品質コマンドの検査の detail が `INTERRUPTED` にそろい、REQ-205 の「品質コマンドの中断」の判定（phases.ts:117）とも一致する。run-decision-policy と run の仕様は変えない。

## Decisions

### D-1 SIGHUP の扱い（REQ-333）

supervisor.cjs の SIGINT・SIGTERM のハンドラの隣に、POSIX だけ `process.on('SIGHUP', () => stop('interrupted'))` を足す。stop の手順（SIGTERM → 250ms → SIGKILL → 最大 1 秒待つ → 結果）は変えない。親が生きていれば、`kind:'interrupted'` の結果を読み、理由のない ProcessLimitError を返す（process.ts:450-453）。親が先に終わっていたら、監視役は stop の中で先にグループへ送り、そのあとの書き出しで失敗して終わってもかまわない。

### D-2 exit 時の SIGKILL（REQ-334）

POSIX だけ `process.on('exit', () => { if (child && child.pid && !exited) kill('SIGKILL'); })` を足す。

- 対象の先頭のプロセスを回収する前（`!exited`）は、PID が再利用されないので、グループの番号は監視役のものに限られる。回収したあとは送らない。回収と exit のコールバックの間に JS は動かない。
- 正常に終わったときは、exited が真なので送らない。停止の経路で 1 秒以内に exit が来なかったときは、もう一度 SIGKILL を送るが、送り先は自分のグループなので害はない。
- exit イベントが起きない終わり方（SIGKILL、ハンドラのない信号）は塞げない。REQ-250 の親の後片付けに任せる。

### D-3 Windows

SIGHUP のハンドラと exit 時の SIGKILL は、Windows では登録しない。コンソールを閉じたときの Windows の停止を、CI で確かめる方法がない（change stop-children-when-supervisor-dies の Q-01 と同じ扱い）。Windows では今までどおり、親が生きていれば保持役による後片付け（REQ-252）で止める。

### D-4 文書

run-recovery の「品質コマンドやgitの実行中に届いた中断は、そのコマンドが終わったところで扱い」を、次のように書き分ける。

- Ctrl+C や端末を閉じたときのように、信号がプロセスグループ全体に届いたときは、実行中のコマンドを子のプロセスまで止めてから、中断として扱う。
- `kill <PID>` のように、loomake のプロセスだけに届いたときは、そのコマンドが終わったところで扱う。

証拠の記録・push・PR の作成に進まないことは変えない。REQ-208 の本文はそのままで成り立つので、run の仕様は変えない。

## 受入条件と確認方法

| # | 受入条件 | 確認方法（テスト）| 修正前 | 修正後 |
|---|---|---|---|---|
| AC-1 | 対象の実行中に監視役が SIGHUP を受けると、`ProcessLimitError` の kind は `interrupted` で、`reason` は undefined になる。孫も止まり、同じ予算で次の操作を起動しない | `process.test.ts` に `[REQ-333] 監視役へのSIGHUPを理由のない中断として返し、子孫を止め、同じ予算で次を始めない` を足す（POSIX だけ）。:92 の試験の SIGINT を SIGHUP に変え、:105 と同じ孫を加え、`withProcessBudget` で次の操作を拒むことも確かめる | reason に「監視役が結果を書かずに終了しました（シグナル SIGHUP）」が入り、失敗する | 成功 |
| AC-2 | 親が後片付けしない状態でも、監視役が SIGHUP を受けたら、自分でグループを止め、fd3 に `kind:'interrupted'` を書く | 新しいファイル `packages/kit/test/supervisor.test.ts` に `[REQ-333] 親が後片付けしなくても、SIGHUPを受けた監視役が対象のグループを止める` を足す。試験から supervisor.cjs を直接 `spawn` し、`stdio:['ignore','pipe','pipe','pipe']`、引数は `[node, ['-e', 孫を作るコード], false, 期限, 上限, null]` とする。fd3 の pid の行と孫の pid ファイルを待ってから、監視役に SIGHUP を送り、2 秒以内に孫が `alive` でないことを確かめる | 監視役が signal SIGHUP で死に、孫が残って失敗する（本件の孤児） | 成功 |
| AC-3 | verify の品質コマンドの実行中に監視役が SIGHUP を受けると、検査の detail は `INTERRUPTED` で、後のコマンドを実行しない | `verify.test.ts:351` にならい、`[REQ-333] 品質コマンドの途中で監視役がSIGHUPを受けたら、中断で止めたと理由なしで記録し、残りを実行しない` を足す（POSIX だけ）。`project.ts` の `INTERRUPT_SCRIPT` を `interruptScript(signal)` にし、`INTERRUPT_SCRIPT = interruptScript('SIGINT')` を残す | detail が `中断されたので止めました（監視役が…）` になり、失敗する | 成功 |
| AC-4 | 監視役が停止の手順を終えずに例外で終わったとき、対象のグループは止まっている | `supervisor.test.ts` に `[REQ-334] 出力先が閉じて監視役が例外で終わっても、対象のグループを残さない` を足す（POSIX だけ）。監視役を直接起動し、対象には `process.stdout.on('error',()=>{})` を付ける。対象は孫（stdio は ignore）を作り、引き金のファイルができたら stdout に 1 行書いて、そのあとは眠る。試験は pid の行を待ってから `child.stdout.destroy()` で読み口を閉じ、引き金を置く。監視役が EPIPE で終わったことを確かめてから、2 秒以内に孫が止まっていることを確かめる | 孫が残って失敗する | 成功 |
| AC-5 | 既存の試験が通る | 既存の process・orphans・process-startup・verify の試験、`signal-during-sync.test.ts`、`tests/package-artifacts.test.ts`（REQ-208 の SIGHUP）を流す。どれも期待値は変えない | 成功 | 成功 |
| AC-6 | HEAD のビルドで再現を取り直す | `pnpm -r build` のあと、この worktree の dist を読むように `sighup-driver4.sh` を動かし、修正の前と後の出力を PR に書く（Q-01） | — | — |

`signal-during-sync.test.ts` との関係：この試験は信号を送らずに abort を予約するので、影響を受けない。

## 変更対象

| ファイル | 変更 |
|---|---|
| `packages/kit/supervisor/supervisor.cjs` | :91 の次に、POSIX だけの SIGHUP のハンドラと、`!exited` を条件とする `exit` 時の SIGKILL を足す。冒頭のコメントに SIGHUP を足す |
| `packages/kit/test/process.test.ts` | AC-1 の試験を足す |
| `packages/kit/test/supervisor.test.ts`（新規） | AC-2・AC-4。監視役を直接起動する試験 |
| `packages/kit/test/verify.test.ts` | AC-3 の試験を足す |
| `packages/kit/test/project.ts` | `interruptScript(signal)` を足す。`INTERRUPT_SCRIPT` はそのまま残す |
| `docs/guide/2.guides/3.run-recovery.md:100` | 「そのコマンドが終わったところで扱う」を実態に合わせる（D-4） |
| `.changeset/stop-command-group-on-sighup.md` | `"@loomake/kit": patch` |
| `docs/quality/scenarios.json` | この change の Scenario のレビューを足す。変えた試験のファイルを根拠にする既存のレビューは、ハッシュを更新する |
| `docs/worklog/<日付>/<ブランチ>.md` | 作業記録 |

process.ts・runner・cli は変えない。

## 補足

- REQ-335 は使わない。run の status の扱い（Q-02）を将来この change に入れる場合の予備とする。

## 設計工程の記録

| 項目 | 内容 |
|---|---|
| 実行ツール | Claude Code 2.1.308（`.agents/skills/delivery/scripts/ask-opus.mjs` 経由、`--role design`） |
| セッション ID | `180efb22-b5d7-4cbe-80e1-ffb9ce6fad69`（成果物は `.loomake/claude/180efb22-b5d7-4cbe-80e1-ffb9ce6fad69/`） |
| 対象コミット | d5aa30d |
| events.jsonl の assistant モデル | `claude-opus-5-5`（55 ターン） |
| modelUsage | `claude-opus-5-5` に加えて `claude-haiku-5-5`（補助の呼び出し）を含む。このため、スクリプトは「実際の Opus モデル」の確認を満たさないとして `ok:false` を返した |
| 工程の状態 | **未実施**（docs/dev/agent-workflow.md の「終了コード 0 かつ `ok:true` の結果だけを実施済みとして扱う」に従う）。設計の内容を Opus の設計として採用するかは、人の判断待ち |

この change の proposal・specs・design・tasks・trace は、上のセッションの `result.md` を書式だけ合わせて転記したものである。Opus の設計工程を実施済みとは扱わない。
