# フックを動かす git の操作を 1 操作の期限で止めない

## Why

PR #47 のレビューで、run の中の git commit・git push・gh pr create も、1 操作 30 秒の既定の期限で止まることが分かった。lint-staged のように 30 秒を超える pre-commit・pre-push のフックがあるプロジェクトでは、run の全体の期限（既定 60 分）に余裕があっても、タスクのたびに止まる。

## What Changes

- 確認事項 Q-01 の回答に従って、フックを動かす git の操作と PR の作成の期限を決める（おすすめは、1 操作の期限ではなく run の残り時間を使うこと）

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `external-process-budget`: フックを動かす git の操作の期限。

## Impact

runner の git の呼び出しとテストを変える。
