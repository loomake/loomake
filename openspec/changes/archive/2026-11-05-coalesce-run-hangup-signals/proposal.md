## Why

Issue #416 の独立レビューで、端末を1回閉じただけでSIGHUPが2回届き、初回の記録とエンジン停止より前に強制終了する回帰を再現した。承認済みの100ms例外で、重複配送を初回の中断として終える。

## What Changes

- 初回SIGHUPから100ms未満の同じ信号だけを数えず、単調な時計で期間を固定する。
- 100ms以上のSIGHUP、異種信号、初回INT/TERMの2回目は既存の強制終了を保つ。
- 利用者が承認した1試験の入力差分だけを適用し、窓内・境界・期間の非延長を追加試験で確かめる。

## Capabilities

### Modified Capabilities
- `run`: REQ-427 の重複SIGHUP例外を追補する。

## Impact

CLIの信号処理、関連試験、復旧手順を変更する。元のrepair-run-stop-lifecycleと同じPR #425に含めるL3の追補であり、元archiveの要件・完了記録は保持する。
