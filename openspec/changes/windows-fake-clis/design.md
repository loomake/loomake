# Design: windows-fake-clis

## Context

`external-budget.test.ts` の `shim()` は偽のコマンドを拡張子のない shebang のスクリプトとして `bin/` に書き、`bin/` を PATH の先頭に置く。製品の起動の仕方は次のとおり。

- git：`runExternal('git', …)` が監視役（`packages/kit/supervisor/supervisor.cjs`）から `spawn(command, args, { shell: false })` で起動する（`runner/src/git.ts`、`trace/src/record.ts`）。Windows の libuv は shell なしでは `.com`・`.exe` しか探さない。
- gh・OpenSpec CLI：Windows では `shell: true` で起動する。cmd.exe が PATHEXT で `.cmd` を探す。

## Decisions

### 偽の CLI の共通の関数

`helpers.ts` に `fakeCli(repo, command, options)` を置く。偽の CLI は 1 つの CommonJS の本体を持ち、本体は最後まで同期的に動く（止まるときは `Atomics.wait` で待つ）。条件に合えば止まり、合わなければ本物役へ転送する。印（`shim-start`・`forward-start`・`forward-end`・`stall-start`・`delay-start`・`shim-end`）を、偽の CLI ごとのログに JSON Lines で書く。

起動の仕方は OS とコマンドで分ける。

| コマンド | POSIX | Windows |
|---|---|---|
| gh・OpenSpec CLI（shell 経由） | `bin/<名前>`（shebang つきの本体） | `bin/<名前>`（本体）と `bin/<名前>.cmd`（`@node "%~dp0<名前>" %*`） |
| git（shell なし） | `bin/git`（shebang つきの本体） | `bin/git.exe`（`process.execPath` のハードリンク。作れなければコピー）と、`NODE_OPTIONS=--require` で読み込む本体 |

本物役への転送は、元が node のスクリプト（`bin/gh` など）なら `process.execPath` に渡して起動する。拡張子のないファイルを直接起動しない。git は `bin/` を除いた PATH から本物の git の実行ファイルを探して、直接起動する。

### git.exe の作り方

Windows で shell なしで見つかるのは `.exe` だけなので、Node 自身の実行ファイルを `bin/git.exe` にハードリンクする。`NODE_OPTIONS` の `--require` で読み込む本体は、`process.execPath` の名前が `git.exe` のときだけ偽の git として動き、それ以外の node のプロセスでは何もしない。本体は同期的に処理を終えて `process.exit` するので、Node がメインのスクリプトとして読もうとする最初の引数（`rev-parse` など）は読まれない。引数は、Node が絶対パスに直した `process.argv[1]` を、作業ディレクトリからの相対パスに戻して得る。

この作り方は使い捨ての PR #17（run 40237254267）で Windows の CI に一度かけて確かめた。ハードリンクは 1ms で作れ、監視役から `git rev-parse --absolute-git-dir` が偽の git を通って本物へ転送された（1 回 150〜220ms）。止まる偽の git は監視役の期限で taskkill により止まった。`.cmd` の偽の gh から `process.execPath` での転送も成功した。

ほかの作り方は次の理由で採らない。

- `.bat`・`.cmd` の git：shell なしでは見つからない。Node は shell なしの `.bat` の起動も拒む。
- Node の単一実行ファイル（SEA）：Node 24 では postject などの追加の道具が要り、依存が増える。
- 小さな exe をコンパイルする：CI に C のコンパイラが要る。

制約：Node は `git.exe` の最初の引数が `-` で始まると自分のオプションとして読む（`git.exe --version` は Node の版を出す）。製品が期限の試験の中で呼ぶ git は、どれもサブコマンドから始まるので影響しない。偽の git を置くのは、`fakeCli` を呼んだ試験の中だけである。

### 狙った段階に届いた印

`expectStalled(cli, match)` は、次の 2 つを確かめてから、止まった印を返す。

1. `match` に合う引数の `stall-start` がある
2. それより前の `forward-end` に `error` がない（本物役の起動に失敗していない）

試験はこの検査を期限・終了コード・停止の理由・summary の検査より前に置く。偽の CLI が呼ばれずに本物が動いたときや、転送が失敗して別の段階で止まったときは、ここで落ちる。

### 時間の関係の検査

止まるまでの時間は印の時刻と試験の時刻から次のように確かめる。

- 1 操作の期限で止まる試験（ロック取得の git・auth・list・trace の git・OpenSpec 検証）：止まった印から止まるまでが「1 操作の期限 + 停止の猶予」より短い。偽の CLI が止まる時間は、それより十分長くする（10 秒）。偽の CLI が自分で終わったのではなく、期限で止められたことが分かる。
- 共有の期限で止まる試験（push・create）：run の所要時間が「共有の期限 - 500ms」以上で、「共有の期限 + 停止の猶予」より短い。止まった印から止まるまでが 1 操作の期限（5 秒）より長い。1 操作の期限ではなく、共有の期限で止まったことが分かる。
- 準備で使った時間を含めてエンジンの期限を制限する試験：準備の `gh auth status` を偽の gh で決まった時間だけ遅らせる。run の所要時間が予算以上で、「予算 + 停止の猶予」より短いことを確かめる。遅らせる時間を停止の猶予より長くするので、エンジンに予算を最初から与え直すと上限を超える。エンジンが呼ばれたこと（偽の claude の呼び出しが 1 回）も確かめる。
- run の準備中に git が止まる試験：run の所要時間が run の期限以上で、「期限 + 停止の猶予」より短い。

停止の猶予は監視役の SIGTERM から SIGKILL までの 250ms と、子の終了を待つ最大 1 秒、Windows の taskkill の最大 1 秒を含めて 3 秒にする。

### 予算を延ばすところ

Windows は外部操作 1 回の起動に 100〜200ms かかる。偽の git を通すと、node の起動がさらに 1 回増える。準備や証拠の記録だけで固定の予算を使い切らないように、次の値を延ばす。延ばした値は上の関係の検査で裏づける。

- push・create の共有の期限：狙った段階に届いたあとに、1 操作の期限（5 秒）より長く待てる長さにする。値は Windows の CI の印の時刻を見て決める。
- 準備の時間を含める試験の予算：遅らせる時間と準備の時間を足しても、エンジンを呼べる長さにする。
- run の準備中に git が止まる試験の run.timeoutMinutes：偽の git の起動を含めてもロック取得に届く長さにする。

## Risks and limits

- Windows の CI でしか確かめられないことがある。手元（Linux）では、POSIX の偽の CLI が呼ばれることと、印の検査が通ることだけを確かめる。
- 期限・中断の試験は CI の負荷で揺れる。Windows の CI で 2 回以上流し、回数と結果を記録する。
- 監視役が SIGINT で強制終了する問題（Issue #5 の ⑥）は直さない。change C で扱う。
