# rename-acceptance-to-release

## Why
要件定義 v0.11.1（docs/requirements/loomake-v0.11.md）で、Loomake の対象を受託から自社プロダクトと OSS に変え、出口を検収からリリース記録・リリースレポートに置き換えた。文書と README は PR #67 で直したが、仕様・CLI の出力・配布テンプレートには「検収レポート」「検収数値」「顧客」が残っていて、利用者に見える言葉が設計と食い違っている。

## What Changes
- `loomake trace report` の出力の名前を「検収レポート」から「リリースレポート」に、表の見出しを「要件ごとの検収」から「要件ごとの結果」に変える（REQ-070・REQ-071・REQ-131）。CLI のヘルプと `trace answer` の案内も合わせる
- req-to-openspec Skill のテンプレートで、「検収数値」を「受け入れの数値」に、change の単位を「リリースの単位」に、確認事項の文面の宛先を「顧客」から「要件を出した人」に変える（REQ-028・REQ-029・REQ-033）。配布する AGENTS.md の「顧客の要件書」も「要件書」にする
- 仕様の Scenario と テストの例の値から「顧客」を外す（REQ-011・REQ-077・REQ-078・REQ-202）

## Non-goals
- リリース記録（`role: release`）と承認状態の実装（WBS の W5-1）。この change は呼び名と文面を変えるだけで、レポートの中身と JSON の構造は変えない
- 証拠の記録の `schemaVersion` と、レポートの JSON の項目名を変えること
- docs/evaluation.md・docs/review.md・docs/quality/scenario-audit.md（評価の記録と仕様の引用）を書き換えること

## Impact
- 影響する capability：trace-report（Requirement の改名と変更）・req-to-openspec-skill（Requirement の改名と変更）・trace-agreement・core-parsers（Scenario の例の値）
- 影響するコード：`packages/trace/src/report.ts`・`agreement.ts`・`index.ts`、`packages/cli/src/main.ts`、`packages/kit/templates/`（AGENTS.md、skills/req-to-openspec）と `.agents/skills/req-to-openspec/`、各テスト、docs/usage.md・docs/quickstart.md・docs/positioning.md・docs/compatibility.md・README・packages/*/README.md
- 利用者に見える変更：Markdown のレポートの見出しが変わる。`--format json` の構造は変わらない
