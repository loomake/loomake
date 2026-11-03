# Proposal
## Why
#278は名前だけのテストを合格証拠にしない取得器を必要とする。標準JSONやexpect生成数だけではbodyの実matcherを区別できない。
## What Changes
- 明示bodyの実呼出しと試行の原情報を、既存@loomake/kit入口から収集する。
## Non-goals
reader・gate・loomake/vitest入口・設定自動変更は後続とし、親#278を完了にしない。
## Capabilities
### New Capabilities
- `test-body-evidence`: テスト本体のmatcher呼出しと試行の原情報の収集。
### Modified Capabilities
なし。
## Impact
core型・kit公開関数・52境界・kit tarball consumer・導入案内・changeset・同期archive。既存API/JSON/C001・依存・Node下限・期待/skip/期限・CLI入口を保持する。
