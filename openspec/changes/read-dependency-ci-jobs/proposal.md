# Proposal

## Why
#285の明示CI job検査を取得と照合・接続に分ける。先行する本子は内部取得を用意し、照合と両ゲートへの接続は後続に残す。
## What Changes
- 宣言したjobの数字から固定APIを同期で読み、同じjobの成否を1回だけ取得してJSONの未検証値を返す。
- 同repoのghコンテキストを使いGH_REPOによる上書きを除く。1件64MiB/合計128MiB・操作期限・共有予算・中断を区別する。
- 64MiBちょうどの公開入口のENOBUFSを避けるため、REQ-412のprivateなbytes入口を再利用し、公開入口を変更しない。
## Capabilities
### New Capabilities
なし。
### Modified Capabilities
- `verify`: 内部取得契約を追加する。REQ-401・run.ts・CLIの振る舞いは本子では変えない。
## Impact
新規のkit内部moduleと単体試験、計画、changeset、日誌、自身の同期archiveが対象。Raw REQ-412の受入に依存し、baseはmain7fe840edを含むraw530b8582。取得済みをDoD完了やPASSにしない。後続のREQ候補416・MODIFIED REQ401・旧試験2箇所・head比較の未決と親285を残す。
