# エンジンの出力と記録の既定の上限を合わせる

## Why

Issue #51。エンジン 1 回の出力の上限（`run.maxOutputBytes`、既定 64MiB）と、1 回の実行の記録の上限（`run.maxLogBytes`、既定 128MiB）が合っていない。出力は `NN-output.json` に全部保存し、完了ゲートの直しを含めてエンジンを最大 6 回呼ぶので、出力の多い呼び出しが 3 回あると、エンジンと時間に余裕があっても、記録の上限で止まる。

## What Changes

- エンジンの出力の既定の上限を 16MiB に下げる（確認事項 Q-01 の回答）。`run.maxOutputBytes` で、これまでどおり変えられる
- 既定値どうしが合っていることを、テストで確かめる

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `run`: エンジンの出力の既定の上限と、記録の上限との整合。

## Impact

runner の既定値と、関係する文書を変える。設定で上限を指定しているプロジェクトの動作は変わらない。
