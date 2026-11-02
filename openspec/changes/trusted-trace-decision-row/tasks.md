# Tasks

Q-ROW-01の本人回答Aを反映し、仕様ゲート成功後に最小5aだけを進める。親/D38/S1の未完了は保持する。

## 1. 仕様確定
- [x] 1.1 Q-ROW-01の回答を得て候補仕様を確定し、strictとspec-onlyの実exit0を確認する（REQ-390）

## 2. 実装と試験
- [x] 2.1 新規T-ROW-01〜06を先に書き、ID完全一致・重複・空回答/承認・記録値保持・凍結のREDを保存する。Q回答による追加Scenarioも含める（REQ-390）
- [x] 2.2 私的部品を実装して新規試験をGREENにし、常時false・既存parser/exports/依存不変を確認、kit patch changesetを付ける（REQ-390）

## 3. 全体確認
- [ ] 3.1 保持表、既存trusted試験、全差分300行目安と作業記録を確認する（REQ-390）
- [ ] 3.2 `pnpm -s verify --change trusted-trace-decision-row --done --scope local` の実exit0を確認する（REQ-390） <!-- loomake:gate=done -->

最終受入はCI done・必須5チェック・必要3OS・独立Opus最終レビューで別に確認する。子の受入を親/S1の完成に数えない。
