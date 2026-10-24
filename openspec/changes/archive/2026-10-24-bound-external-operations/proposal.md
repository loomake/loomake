## Why

Git・ghと準備中の外部操作には期限がなく、runの残り時間があっても終了を待ち続ける。停止時に作業を保てる実行境界を共通化する。

## What Changes

- **BREAKING** Git・gh・エンジン存在確認・OpenSpec検証に、既定30秒/操作の期限を設ける。
- runは開始時からの実時間で全体の残り時間を共有し、各操作の期限を短い方へ制限する。
- 品質コマンドにも同じ監視を使い、時間切れ・出力超過・中断と子プロセスの停止を扱う。

## Capabilities

### New Capabilities

- `external-process-budget`: 同期外部操作の期限・出力・停止とrun全体の共有予算

### Modified Capabilities

なし。既存のエンジンと品質コマンドの期限を維持し、残る外部操作へ補足する。

## Impact

kitの共通I/O、runnerのGit・gh・準備、traceのGit、verifyの検証と品質コマンド。依存の追加なし。通常の終了コードと証拠・summaryのJSON形式は維持する。
