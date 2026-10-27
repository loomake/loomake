# 監視役が結果を書かずに終わっても、子孫を止めて中断として返す

## Why

Issue #5 の原因⑥（change C）。Windows で別のプロセスから監視役に `process.kill(pid, 'SIGINT')` を送ると、Node はシグナルを届けずに監視役を強制終了する（Node の文書の signal events）。監視役は fd 3 に結果を書かずに終わるので、いまの親は次のように振る舞う。

- 「外部操作の監視結果を読み取れません」を使い方の誤り（`UsageError`、終了コード 2）として返す。REQ-180 の、制限による停止と使い方の誤りの区別に合わない
- 子の PID と `taskkill /T /F` は監視役の中にしかないので、対象のコマンドの子孫が残る
- `state.interrupted` が立たないので、同じ共有予算の後続の操作が始まる

main f2c4db3 の Windows の run 40233833918 では、次の 3 件がこれで落ちている。

- `packages/kit/test/process.test.ts` [REQ-181] 監視役へのSIGINTを中断として返し、子を止める
- `packages/kit/test/process.test.ts` [REQ-181][REQ-182] 中断後に同じ共有予算で別の操作を始めない
- `packages/runner/test/external-budget.test.ts` [REQ-183] 品質コマンドの中断後に次のコマンドを実行しない（加えて、lint の POSIX の `exec` が cmd.exe で通らない）

POSIX でも、監視役が SIGKILL などで結果を書かずに終わると、同じことが起きる。

さらに、dce8ddf の Windows の run 40242169987 では、品質コマンドの試験が、品質コマンドが残ることで落ちた。監視役が強制終了すると、直接の子の cmd.exe も一緒に終わり、孫の品質コマンドが親のいない状態で残る（libuv の job object によるという推定で、CI では確かめていない）。親が cmd.exe の PID に送る `taskkill /T` は not found（status 128）で失敗し、孫に届かない（PR #24 の run 40243055420）。レビューの回答（Q-02）に従い、Windows では親が作成時刻と親の PID で対象の子孫を識別して止める。

## What Changes

- 監視役は、対象を起動した直後に、対象の PID を fd 3 に先に書く。結果はそのあとに書く
- 監視役は対象の PID と一緒に、対象を起動する直前と直後の時刻を書く（作成時刻の範囲）
- 親は、監視役の結果が読めなかったとき（結果を書かずに終わった・結果を解釈できない）に、先に受け取った PID で対象の子孫を止める。POSIX はプロセスグループへ SIGTERM、250ms 後に SIGKILL を送る。Windows は PowerShell でプロセスの一覧を取得し、作成時刻と親の PID で対象とその子孫を識別する。対象がもういないか、PID が再利用されているときだけ、親の PID が対象の PID である子を探す。止める直前にハンドルを開いて作成時刻を確かめ、一致したものだけを止める
- Windows の後片付け（一覧の取得・識別・停止・終了の待機）は合わせて 10 秒を上限とする。通常の共有予算は延ばさない
- 子孫の停止を確認できなかったとき（一覧の取得の失敗・時間切れ・権限不足・同一性を確認できない・残っている）は、中断の理由に「子孫の停止を確認できません」とその理由を加え、停止できたときと区別する
- そのときは、理由（終了コード・シグナル、または結果を解釈できないこと）を含む中断（`ProcessLimitError`、kind は `interrupted`）として返し、同じ共有予算の `state.interrupted` を立てる。利用者の中断と区別できるよう、理由を `reason` に入れ、メッセージにも書く
- 品質コマンドの中断の試験は、`exec` を使わず、祖先をたどって監視役を見つけてから SIGINT を送る。送った先が監視役であることを記録して確かめる

## Non-goals

- コンソールの Ctrl+Break（`SIGBREAK`）のハンドラ。Windows の CI で本物の Ctrl+Break を監視役だけに送って確かめる方法がまだないので、この change では扱わない（Q-01）
- 監視役が対象を起動してから PID を書くまでの間に強制終了された場合の子孫の停止。この間は PID を親に渡せない
- 子孫の途中のプロセスが先に終わり、親の PID をたどれなくなった孫の停止
- 監視役が終わってから親が終了を受け取るまでの間に、対象の PID を再利用して子を作り、すでに終わったプロセスの子の区別（A-02）
- Windows の通常の run の起動の仕方（detached にする案 A は採らない）
- 監視役の起動の失敗（`spawnSync` のエラー）の扱い。今までどおりエラーとして返す

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `external-process-budget`: 監視対象の子プロセスの停止（REQ-181）に、監視役が結果を書かずに終わったときの停止と分類を足す。監視役が結果を書かずに終わったときの子孫の後片付け（REQ-252・REQ-253・REQ-254）を足す。

## Impact

kit の `runtime/process.ts` と `supervisor/supervisor.cjs`、kit と runner のテスト、kit の changeset を変える。`ProcessLimitError` に省略できる `reason` と `cleanup` を足す（公開 API への追加）。設定・実行時依存・出力 JSON の版は変えない。
