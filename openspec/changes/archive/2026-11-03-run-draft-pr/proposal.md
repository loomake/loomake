# Proposal

## Why
#80/W3-2は1つのchangeがDraft PRになることを求める。local接続はmainにあるが、新規PR作成に--draftがない。

## What Changes
新規作成だけをDraftにする。既存Ready/Draftは状態を変えず再利用し、Draft作成失敗は既存経路で止める。

## Capabilities
### New Capabilities
なし。
### Modified Capabilities
- `run-pr`: REQ-116へ新規Draft義務と回帰を追加。
- `run`: REQ-165へ既存状態保持を明記。

## Impact
runnerと対応試験・usage・changeset。local/ci区別、本文、記録順、向き先、期限、認証、JSON/APIと既存assertの条件を保持する。
