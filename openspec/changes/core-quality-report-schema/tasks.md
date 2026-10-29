# Tasks

この一覧は Q-01 の案 A の承認と、管理役からの正式な実装指示に基づく。

## 1. 仕様の確認

- [x] 1.1 Q-01 の回答・回答者・回答日を trace.md に記録し、回答に合わせて proposal・design・差分仕様を揃える。`pnpm exec openspec validate core-quality-report-schema --strict` と `pnpm -s verify --change core-quality-report-schema --spec-only` の成功を確認する（REQ-301）。

## 2. 承認後のスキーマと対応テスト

- [x] 2.1 承認された最小スキーマと導出型を core から公開する。`[REQ-301]` を付けたテストで最小入力・未知項目保持・不正な版・オブジェクト以外を確認し、入口から zod を静的に読まない既存の契約を維持する。利用方法を記録してコミットする。
- [ ] 2.2 quality-report の JSON Schema を既存の書き出し処理で生成して公開する。`[REQ-301]` のテストで書き出し差分と Zod・JSON Schema の受理と拒否の一致を確認する。既存の verify・quality スキーマと `trace report --format json` の回帰試験を通し、changeset と作業記録を含めてコミットする。

## 3. 統合確認

- [ ] 3.1 lint・型検査・全体テストと Requirement の ID 付きテストを確認する。`pnpm -s verify --change core-quality-report-schema --done` の成功を記録する（REQ-301）。 <!-- loomake:gate=done -->

## Workflow follow-up

- PR の独立レビューと必須 CI を確認し、承認範囲でマージする。未完了の Issue #60 全体を自動 close しない。
- 完了後に対応スキルで archive する。生成・評価・履歴への追加項目は Issue #70 で進める。
