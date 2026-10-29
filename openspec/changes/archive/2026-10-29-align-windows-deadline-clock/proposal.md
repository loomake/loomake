# Proposal

## Why

PR #124で実時間と保持役の準備待ちを同じ初回runで測定した。Windowsのpush試験は実時間45.089〜47.416秒で失敗したが、仕様が予算から除外する準備待ち4.713〜7.017秒を除くと40.375〜40.402秒で、既存の下限39.5秒・上限43秒に収まった。試験の計時をREQ-257と揃える。

## What Changes

- 初回run前のholderWaitTimeを保存し、既存runElapsedから同runの待ちの差分だけを除く。
- 既存のassertion、予算、猶予、下限、再試行、製品runtimeは維持する。
- 元の試験に要件IDを追加し、Windows3サンプルで再実行まで確認する。

## Capabilities

### New Capabilities

- `ci-deadline-clock-alignment`: 期限試験が準備待ちを仕様どおり区別して共有予算を検証する。

### Modified Capabilities

なし。製品runtimeや期限の値は変更しない。

## Impact

対象はpackages/runner/test/external-budget.test.tsの初回runの計時、要件タグ、空のchangesetと記録。PR #124を土台とする別PRで進める。利用者は2026-10-29の本会話で具体的な差分を承認済み。
