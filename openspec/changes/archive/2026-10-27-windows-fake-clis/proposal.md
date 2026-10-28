# Proposal: windows-fake-clis

## Why

CI の quality (windows-latest) で、`packages/runner/test/external-budget.test.ts` の期限の試験が落ちる。見かけの合格になっている試験もある（[Issue #5](https://github.com/loomake/loomake/issues/5) の ④⑤）。原因はテストの前提にある。

- 偽の git・gh・OpenSpec CLI を、拡張子のない shebang のスクリプトとして書いている。製品は git を shell なしで起動するので、Windows では `.exe` しか探さない。偽の git は呼ばれず、本物の git が動く。
- gh は shell 経由で起動するので、偽の gh は呼ばれる。ところが本物役へ転送するときに拡張子のない node のスクリプトを直接起動するので、ENOENT で失敗する。
- 偽の CLI に届いたかどうかを確かめずに、期限・終了コードを検査している。そのため、本物のコマンドの速さで合否が決まる見かけの合格になる。
- Windows は外部操作の起動が遅い。準備だけで固定の予算を使い切り、狙った段階に届かないことがある。

## What Changes

- 偽の CLI を作る共通の関数を `packages/runner/test/helpers.ts` に置く。Windows では shell 経由で起動する gh・OpenSpec CLI に `.cmd` を、shell なしで起動する git に `.exe` を用意する。本物役への転送は node のスクリプトなら `process.execPath` で起動する。
- 期限の試験は、偽の CLI が狙った操作で止まった印と、それより前の転送が起動に失敗していないことを先に確かめる。そのあとで、期限・終了コード・「実行時間の上限」・summary を確かめる。
- 予算を延ばす試験は延ばすだけで終えない。「1 操作の期限または共有予算より長く待った」「期限に猶予を足した時間のうちに止まった」という関係も確かめる。
- 子孫の停止、期限後の後続処理の禁止、再実行での重複防止の検査は残す。期待値は変えない。skip もしないし、Windows だけを対象外にもしない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `monorepo`: 外部操作の期限の試験が 3 つの OS で狙った段階に届いたことを確かめる要件（REQ-240）を足す。製品の振る舞いは変えない。

## Impact

`packages/runner/test/helpers.ts` と `packages/runner/test/external-budget.test.ts` を変える。製品のコード、公開 API、設定、依存は変えない。changeset は空にする（配布するパッケージは変えない）。

対象外の試験は次のとおり。

- `[REQ-183] 品質コマンドの中断後に次のコマンドを実行しない` と `packages/kit/test/process.test.ts` の 2 件は、監視役の強制終了という製品の不具合なので、change C で扱う。
- `run.test.ts` の REQ-158、`scripts/` の配布物、`release-security`、`guards` は change A（fix-windows-test-assumptions）で扱う。
