# Proposal

## Why
#285 の依存宣言は C1a の内部 reader だけでは verify の利用者に届かない。提供元の完了を確認できていない宣言を、仕様ゲートの案内と完了ゲートの証拠不足として示す。
## What Changes
- REQ-401 を追加し、全3種類の宣言の構文エラー・未確認の表示と判定を verify に接続する。
- C1b は外部操作を行わず、構文が正しい宣言を全件未確認にする。提供元 DoD の照合は後続の子で実装する。
- 宣言がない場合の結果と入力予算、既存の失敗・承認判断・例外を維持する。
## Capabilities
### New Capabilities
なし。
### Modified Capabilities
- `verify`: 任意の依存宣言について、構文の誤りと提供元の証拠の未確認を判定・表示する。
## Impact
`packages/kit/src/verify/run.ts` と新規の kit 試験、CLI 利用者側の試験を対象にする。C1a の REQ-400 reader が前提で、現時点では未受入。公開型・4 callers・依存パッケージ・設定・CI 権限は変更しない。自身の仕様同期・archive・日別記録・changesetを同じ実装 PR に含め、親 #285 を完了にしない。
