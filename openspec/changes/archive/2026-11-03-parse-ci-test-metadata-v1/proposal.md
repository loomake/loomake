# parse-ci-test-metadata-v1

## Why
WBS W1-3の残りに、本人が選んだCI診断metadata v1とreportの組を加える。大きい1本を避け、先にmetadataの中立な公開変換を独立受入する。

## What Changes
- 既知11項目のparser・公開型・公開consumerと正負の回帰を加える。Q-C003-02は本人回答Aを採用した。

## Capabilities
### New Capabilities
なし。
### Modified Capabilities
- core-parsers：CI診断metadataの中立な変換契約を追加する。

## Non-goals
- reportとの組合せはcombine-ci-test-artifact-reportで後続受入し、metadataだけで本人Aの到達点や#62/C003を完了にしない。
- 取得・writer配布・判定・日時補完・host隔離・全provider・partial/禁止キー・A03/A04の親残義務を削らない。

## Impact
core-parsers、coreのparser/exports/consumer試験だけ。既存REQ-015/319/283/378、C001のR03 A・S1→S2・C4受入順とTEST/PINを保持する。
