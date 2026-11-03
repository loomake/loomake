# 品質 YAML の反映結果を既存報告へ追加する

## Why

品質 YAML の適用後に、何を反映したか、何が未反映か、どの必須証拠が未観測かを把握する必要がある。元 B2 の結果報告を後続機能として分け、旧報告を保って追加情報を届ける。

## What Changes

- 元 REQ-411 の本文・二 Scenario を同じ ID で移管し、Step 7 に反映・未反映・証拠不足の三項目を加える。
- 元の報告試験二ケースを全文移管し、旧報告四項目と次の一手を保持する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `req-to-openspec-skill`: 品質 YAML の反映結果の報告を追加する。

## Impact

両 Skill の Step 7、元 root 報告二ケースと guide に追加する。適用・保持は先行 Apply に残し、format・kit 試験・runtime/API・parser/schema・依存・設定は変更しない。
