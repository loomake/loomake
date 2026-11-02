# trusted-trace-decision-row

## Why
C001 C3の採否照合を300行目安で分ける。archive reader設計§3とQ-S1-11が求める実在IDの回答済み行のうち、解析済みモデルの照合を私的部品にする。

## What Changes
- ID完全一致・一意性・回答/承認非空と既知セルの防御的返却を追加する。常にadoptionsVerified:falseとする。
- Q-ROW-01の本人回答Aに従い、空文字・空白だけのIDを拒否する。

## Capabilities
### New Capabilities
なし。
### Modified Capabilities
- `trusted-baseline`：解析済みモデルの記録行照合をREQ-390として追加する。既存要件は変更しない。

## Non-goals
raw文書・archive・表/列・出典/hash・主体/API/本人承認・子4の38行転記・S1接続は後続に残す。親Q-C3-01/02の本人回答Aを反映し、親実装・D38・S1の未完了を保持する。

## Impact
kitの私的srcと新規試験を各1ファイル追加する計画。公開exports・CLI/JSON・core・依存・設定・既存試験は変更しない。
