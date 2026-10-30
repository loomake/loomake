# 端末を閉じたときに、監視役が対象のコマンドを止めずに終わる

## Why

外部操作の監視役（`packages/kit/supervisor/supervisor.cjs`）は、SIGINT・SIGTERM を受けると、対象のプロセスグループを止めてから中断を返す。SIGHUP は捕まえていないので、既定の動作で即座に終わる。対象は別のプロセスグループで動くので、SIGHUP は届かない。

`loomake verify` などの run 以外のサブコマンドは、SIGHUP で CLI も終わる。端末を閉じると、CLI と監視役が同時に終わり、品質コマンド・git・gh が後片付けされずに動き続ける。`loomake run` では、親が監視役の異常終了として対象を止める（REQ-250）。ただし、品質コマンドの検査に「監視役が結果を書かずに終了しました（シグナル SIGHUP）」という理由が付き、SIGINT・SIGTERM のときの記録とずれる。

change stop-engine-on-termination（REQ-208）は、run で SIGHUP も SIGINT と同じく扱うと定めた。品質コマンドの監視役は、まだそうなっていない。

## What Changes

- POSIX の監視役は、SIGHUP も SIGINT・SIGTERM と同じく中断として扱い、対象のプロセスグループを止める（REQ-333）。
- POSIX の監視役は、未処理の例外などで停止の手順を終えずに終わるとき、対象の終了をまだ処理していなければ、終わる直前に対象のグループへ SIGKILL を送る（REQ-334）。
- 復旧の文書で、実行中のコマンドを止める場合と、そのコマンドが終わってから扱う場合を分けて書く。

## Non-goals

- 親の側の扱い（`runtime/process.ts`）。REQ-250 で対応済み。
- run の summary の判定（phases.ts・run.ts）。REQ-208 の CLI のハンドラで interrupted になる。
- Windows のコンソールを閉じたときの停止（trace.md の Q-03）。
- 監視役が SIGKILL・OOM などで結果を書かずに終わったときの run の status（trace.md の Q-02）。
- `kill <CLIのPID>` のように、CLI だけに届いた信号で、実行中のコマンドを即座に止めること。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `external-process-budget`：Requirement を 2 つ足す（REQ-333・REQ-334）。REQ-181・REQ-250 の本文は変えない。

## Impact

`packages/kit/supervisor/supervisor.cjs` と、kit の試験（`process.test.ts`・`verify.test.ts`・`project.ts`・新しい `supervisor.test.ts`）、`docs/guide/2.guides/3.run-recovery.md` を変える。親の外部操作（`runtime/process.ts`）、runner、CLI、公開 API、依存は変えない。配布物の監視役が変わるので、`@loomake/kit` の patch の changeset を足す。

Windows のコンソールを閉じたときの扱いと、監視役が SIGKILL などで終わったときの run の状態は、この change に含めない（trace.md の Q-02・Q-03）。

archive する PR では、この change の Scenario のレビュー（`docs/quality/scenarios.json` の change 側の ID）を、`openspec/specs/external-process-budget/spec.md` 側の ID に移す。
