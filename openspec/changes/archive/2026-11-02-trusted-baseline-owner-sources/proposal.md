## Why

Issue #310に残る所有本文と原Source・capabilityの対応を、C001の私的部品で照合する。Q-S1-14で採用済みのREQ-100への主仕様REQ-331追加所有を保持する。

## What Changes

- 初回基準の構造を照合したあと、各所有本文のcapabilityとSourceを原契約へ対応させる。
- REQ-331の追加所有はコード側の固定値とID付き試験へ照合し、記録側の採否参照だけでは受け入れない。
- 同じ句の置換・未対応の共存と所有共有は未決として親traceへ残す。今回の子は依存しない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- trusted-baseline：所有先と原Sourceの対応を照合する私的な内部契約を追加する（REQ-388）。

## Impact

C2bの同期・archive後に実装するL3。公開exports・API・CLI・JSON・依存・品質設定・既存試験は変えない。Git由来、採否主体・trace行・API、新しい適格実行、移動・補完の採否、共有と排他、S1・親・live・S2の全受入は後続に残す。
