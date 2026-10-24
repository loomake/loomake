# stop-gate-on-interrupt

## Why
`loomake run` の完了ゲートの最中に Ctrl-C を押しても、品質コマンドが止まらない（作業記録 2026-10-24 の 24 節）。run は完了ゲートの品質コマンドを、時間の上限を見張るスクリプトの下で、別のプロセスグループとして起動する。そのため SIGINT が見張り役にしか届かず、コマンドは最後まで動き、run はその終わりを待つ。止めたコマンドは「不合格」と記録されてテストの失敗と見分けられず、そのあと run は直しのためにエンジンを起動してしまう。

## What Changes
- 完了ゲートの品質コマンドの実行中に中断されたら、そのコマンドを子のプロセスまで止め、中断で止めたと記録する（REQ-124）
- 中断で止めたら、残りの品質コマンドもエンジンも動かさずに、中断した旨の記録を書いて終わる（REQ-124）

## Non-goals
- ふだんの `loomake verify` と `loomake trace record` の中断の扱い（時間の上限を使わないので、Ctrl-C でコマンドに SIGINT が届く）
- Windows での中断の扱い（品質コマンドを別のプロセスグループにしないので、Ctrl-C がコマンドに届く）

## Impact
- 影響する capability：run（Requirement の変更）
- 影響するコード：`packages/kit/src/verify/run.ts`、`packages/runner/src/run.ts`
