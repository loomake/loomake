# 品質 YAML 案の具体差分と証拠不足を示す

## Why

X で作る品質案を一般の分割合意で確認するとき、既存の更新内容や新規ファイルのモデルが具体的に分かる必要がある。未観測の必須証拠による CI の証拠不足も同じ案で示す。

## What Changes

- 追加 ID・値と既存更新の具体差分、または新規全文と model を提示する。
- 未観測の必須証拠と CI の証拠不足を案に添え、新しい承認手順は増やさない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `req-to-openspec-skill`: 原 B1 の REQ-409 全二 Scenario を同じ ID で移管する。

## Impact

両 Skill の X の同じ小節に段落を足し、原 root 試験二件全文と guide を追加する。format、kit の例と試験、YAML の反映、runtime/API・parser/schema・依存・設定は変更しない。
