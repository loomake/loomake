# Proposal

## Why
#285の明示CI job検査（C3a）を、1回の取得、1回のverifyでの共有と予算、照合と両ゲートへの接続の3子に分ける。本子は最初の子として、宣言したjobを同じrepoからghで1回取得する内部の操作を用意する。
## What Changes
- 検証済みのjobの数字から固定APIを同期で1回読み、JSONの未検証値か分類した取得不能と、返った出力のバイト数を返す。
- 同repoのghコンテキストを使いGH_REPOによる上書きを除く。1回64MiBちょうどを受け付け、期限・出力の上限・共有予算・中断は既存の例外のまま投げる。
- 64MiBちょうどで公開入口がENOBUFSになるため、REQ-412のprivateなbytes入口を再利用する。公開入口とREQ-412は変更しない。
## Capabilities
### New Capabilities
なし。
### Modified Capabilities
- `verify`: 内部取得契約REQ-415を追加する。REQ-401・run.ts・CLIの振る舞いは本子では変えない。
## Impact
新規のkit内部module `packages/kit/src/verify/ci-jobs.ts` と単体試験、計画、changeset、日誌、自身の同期archiveが対象。Raw REQ-412の受入に依存し、baseはmain7fe840edを含むraw530b8582。同じjobの1回化・合計128MiB・期限の取得不能化（REQ候補416）、照合と両ゲートへの接続（REQ候補417・MODIFIED REQ-401）、親285を残す。取得済みをDoD完了やPASSにしない。旧試験2箇所とhead比較範囲は未決のまま後続へ残す。
