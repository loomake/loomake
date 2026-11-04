# Proposal: fix-dependency-table-delimiters

## Why

#386 の m1 は、有効な短い区切り行を C1a reader が拒む問題である。C1b を接続する前に修理し、m2 の回答日も原コメント本文へそろえる。

## What Changes

- 区切りセルをハイフン1個以上・両端コロン任意とし、旧契約の全境界と58試験を保つ。旧 archive trace の日付2セルを11/3へ訂正する。

## Capabilities

- New Capabilities: なし。
- Modified Capabilities: `verify` の REQ-400。全5 Scenario を保持し、WHEN 2行で区切りの形を明示する。

## Impact

kit の内部 reader と追加試験、6計画文書・仕様同期・archive・kit patch changeset・日別worklogが対象。CLI・core・公開型・外部操作・設定は変えず、C1b・親#285・U1/U2・DoD/権限/正のCI判定は未完了のまま残す。
