# 出典に基づく品質 YAML の案と一般の分割合意

## Why

#66 の品質側では、確認した品質の定義から UQ/PQ の案を作り、既存の分割合意で確認する必要がある。値の根拠と不足を示し、参考値や未観測を合格の証拠にしない。

## What Changes

- 出典のある値で関連 REQ つき UQ/PQ 案を作り、不足値は関連 Q にする。
- target・既存 evidence・context の実定義参照を保ち、同じ案を既存の分割合意で確認する。
- 既存 reader で読める例と、観測がなければ PASS しない試験を追加する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `req-to-openspec-skill`: REQ-408 の品質案と既存一般合意への接続を追加する。

## Impact

両 Skill・format reference・構造試験・kit の例の読取と判定・guide を追加する。具体差分・新規全文/model の明示と証拠不足告知は Y、合意した反映は B2 に残す。runtime・公開 API・parser/schema・依存・設定は変えない。
