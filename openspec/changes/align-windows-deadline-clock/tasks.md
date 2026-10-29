# Tasks

- [ ] 1.1 仕様ゲートを通し、承認済みpatchを適用して元のit.eachに[REQ-297]を追加する。既存の値とassertionの維持を照合し、対象4ケースと時計の集計、Lint・型検査を通してコミットする。
- [ ] 2.1 空のchangesetと作業記録を追加し、全タスクをチェックした `pnpm -s verify --change align-windows-deadline-clock --done` のexit 0と要件の試験対応を確認してコミットする。

## Workflow follow-up

- PR #124をbaseに別PRを作り、Windowsで同じ4ケースを固定3サンプル測定する。pushの再実行まで通ることを確認し、失敗や未計測も記録する。マージとarchiveは行わない。
