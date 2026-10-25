## Why

現在の要件対応はREQ-ID単位であり、同じRequirementの各Scenarioを実際に試験したか判断できない。レビューの根拠をScenarioごとに残し、未確認と不足を隠さず更新できるようにする。

## What Changes

- リポジトリの品質確認用にScenarioの一覧と、手でレビューした試験との対応を検査するツールを追加する。
- REQ-IDの一致は候補とし、対応理由、仕様とテストのハッシュ、実行結果が揃うまで確認済みにしない。
- 現行仕様と進行中の変更を一覧化し、上書きされたScenarioも参照先付きで区別する。
- 差分仕様の削除指示をScenarioの一覧から除外し、正常な削除で全体監査が停止しないようにする。通常の要件でScenarioがない場合の検査は維持する。
- 初回の対応表と不足を文書化する。CLIや既存のverifyの合否は変えない。

## Capabilities

### New Capabilities

- `scenario-evidence-audit`: Scenarioと試験の対応のレビューと、根拠の更新確認

### Modified Capabilities

なし。

## Impact

scripts、tests、品質確認の文書と対応表。製品の実行時依存、公開API、既存のverify設定は変更しない。
