# Proposal

## Why
#310第3項では、任意の原文書と追従する候補indexが低位の構造照合を通る。固定原本の確認に成功した値だけを後段へ渡す私的入口が必要である。

## What Changes
- REQ-389を追加し、構造照合とC001記録照合の2入口で原14文書を内部検証する。
- hashとC001のPINを内部に固定し、原文書の各欄を一度だけ写して同じ値を照合・転送する。
- 既存の低位API・試験・manifest・予算・エラーは変えない。保証は新入口の内部に限る。

## Capabilities
### New Capabilities
なし。
### Modified Capabilities
- `trusted-baseline`：原本確認と後段照合の接続（REQ-389 ADDED）。

## Impact
kitの私的srcと試験を各1ファイル追加する。Git取得・指定Aの束縛・監視・所有文書の来歴・低位直呼び制御・S1/controller接続・主体・新実行は対象外とし、#310第3項と親/S1は未完了のまま保つ。REQ388子と共有ファイルは編集しない。
