# combine-ci-test-artifact-report

## Why
本人が選んだmetadata v1とreport本文または不在の組を、既存の変換から作る。metadata単独のM1（#380、main 7d7f69b5）を受け入れたため、本人Aの最初の組合せ機能を仕上げる。

## What Changes
- parseCiTestArtifactと組の公開型・consumerを加え、既存parseTestReportをそのまま再利用する。
- Q-C003-02/03は本人回答Aを採用した。

## Capabilities
### New Capabilities
なし。
### Modified Capabilities
- core-parsers：REQ-392の組合せ変換を追加し、既存REQ-391は変更しない。

## Non-goals
- 取得・writer配布・結付けの保証・鮮度/適格性/合否判定は後続C003。#62やW1-3全体は閉じない。

## Impact
core-parsersとcore公開入口。M1の公開parserを再利用し、既存parser・配布JSON Schema・依存・C001の受入順を保持する。自身の仕様同期/archiveは同じ実装PRへ含める。
