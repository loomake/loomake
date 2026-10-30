# 端末を閉じたときに、監視役が対象のコマンドを止めずに終わる

## Why

外部操作の監視役（`packages/kit/supervisor/supervisor.cjs`）は、SIGINT・SIGTERM を受けると、対象のプロセスグループを止めてから中断を返す。SIGHUP は捕まえていないので、既定の動作で即座に終わる。対象は別のプロセスグループで動くので、SIGHUP は届かない。

run 以外のサブコマンドで監視役を通るのは、verify の openspec validate、trace record と doctor の git である。端末を閉じると、CLI と監視役が SIGHUP で終わり、対象とその子が後片付けされずに残る。CLI の verify と trace record の品質コマンドは監視役を通らず、この問題の対象外である。`loomake run` では、親が監視役の異常終了として対象を止める（REQ-250）。ただし、品質コマンドの検査に「監視役が結果を書かずに終了しました（シグナル SIGHUP）」という理由が付き、SIGINT・SIGTERM のときの記録とずれる。

change stop-engine-on-termination（REQ-208）は、run で SIGHUP も SIGINT と同じく扱うと定めた。品質コマンドの監視役はまだそうなっていない。

## What Changes

- POSIX の監視役はSIGHUP も SIGINT・SIGTERM と同じく中断として扱い、対象のプロセスグループを止める（REQ-333）。
- POSIX の監視役は未処理の例外などで停止の手順を終えずに終わるとき、対象の終了をまだ処理していなければ、終わる直前に対象のグループへ SIGKILL を送る（REQ-334）。
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

`packages/kit/supervisor/supervisor.cjs` と、配布物の E2E（`scripts/verify-sighup-smoke.mjs`・`tests/package-artifacts.test.ts`）、kit の試験（`process.test.ts`・`verify.test.ts`・`project.ts`・新しい `supervisor.test.ts`）、`docs/guide/2.guides/3.run-recovery.md` を変える。親の外部操作（`runtime/process.ts`）、runner、CLI、公開 API、依存は変えない。配布物の監視役が変わるので、`@loomake/kit` の patch の changeset を足す。

Windows のコンソールを閉じたときの扱いと、監視役が SIGKILL などで終わったときの run の状態は、この change に含めない（trace.md の Q-02・Q-03）。

archive する PR ではこの change の Scenario のレビュー（`docs/quality/scenarios.json` の change 側の ID）を、`openspec/specs/external-process-budget/spec.md` 側の ID に移す。

## 設計の依頼の要点

[PR #158](https://github.com/loomake/loomake/pull/158) の依頼はPOSIX の監視役に SIGHUP の中断処理を足し、親が同時に終わっても対象のグループを残さないことと、exit 時の SIGKILL による後片付けの是非を調べることである。親の ProcessLimitError は REQ-250 で対応済みなので変えない。REQ-333〜334 をこの change で扱う。元の再現は worktree 外の古い dist を読んだ可能性があるため、Q-01 に従いこの worktree のビルドで取り直す。

2026-10-30 の再設計はREQ-334 の送信条件を `!exited` から「グループへ SIGKILL をまだ送っていない」に変える案を提示した。これは現行の否定 SHALL と異なるため、Q-04 の人の回答を待つ。上の What Changes と差分仕様は、回答前の仕様を保つ。
