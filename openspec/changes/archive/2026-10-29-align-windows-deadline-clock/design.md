# Design

## Context

既存REQ-257は保持役の準備待ちを操作期限とrun共有予算から除外する。本体はbudgetNowで除外している。同じ試験ファイルの別ケースもholderWaitTimeの差分を経過時間から除いているが、push・createの共有期限のケースでは実時間だけを使っていた。

## Decisions

承認された/tmp/loomake-windows-deadline-clock-fix.patchをそのまま適用する。run開始時のholderWaitTimeを保存し、終了時との差分をendedAt-runStartedから除く。診断の実時間と予算上の時間は維持する。

共有予算、1操作の期限、猶予、上限・下限のassertion、停止地点の確認、再実行で証拠・PRを再利用する確認は変更しない。製品runtimeと品質設定は変更しない。待ちがない環境では従来と同じ値になる。

REQ-297の対応は元のit.eachの要件タグへ追加する。実装を写す新規試験は増やさず、元の試験と実測で確認する。Windowsの固定3サンプルではpushが再実行まで通ること、元の成否と時計が一致することを確認し、失敗があればそのまま記録する。成功までの再試行はしない。

## Risks / Trade-offs

同じ初回runの前後の差分だけを除く。プロセス全体の累積待ちを直接除いたり、実時間の表示まで置き換えたりしない。時計の診断値が範囲内でも他のassertionが通るとは限らないため、Windowsで元の操作結果を確認する。
