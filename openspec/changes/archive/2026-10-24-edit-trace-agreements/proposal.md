# 確認事項の回答と仮定の承認をコマンドで書く

## Why

確認事項の回答と仮定の承認は、人が trace.md の Markdown の表を直接書き換えている。列の位置を間違えたり、回答者・回答日を書き忘れたりしやすく、顧客とのやりとりが多い案件では手間が大きい。2026-10-24 の品質評価の使いやすさで、この手間が残った。

## What Changes

- `loomake trace answer` で、確認事項の回答・回答者・回答日を書く
- `loomake trace approve` で、仮定の承認・承認者・承認日を書く
- すでに回答や承認がある行は上書きしない

## Capabilities

### New Capabilities

- `trace-agreement`: 確認事項の回答と仮定の承認を、trace.md に書くコマンド。

### Modified Capabilities

なし。

## Impact

core に表の行を書き換える純粋な関数を、trace にファイルの読み書きを、CLI に 2 つのサブコマンドを足す。trace.md の形式と verify の判定は変えない。
