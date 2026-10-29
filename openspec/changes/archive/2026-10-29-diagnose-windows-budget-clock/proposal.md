# Proposal

## Why

PR #120のWindows計測では、push期限試験が3回とも実時間45.427〜46.770秒で失敗した。本体はREQ-257に従って保持役の準備待ちを予算から除外するが、当該試験は実時間で43秒と比較している。停止遅延と計時基準の差を判断するため、同じ実行で両方を記録する。

## What Changes

- 明示的に有効にしたpush・createの初回runについて、実時間、保持役の準備待ち、待ちを除いた予算上の経過時間を記録する。
- 既存の区間計測へ独立した時計の診断を追加し、欠損や不整合を明示する。
- 既存のWindows3サンプルworkflowで取得し、元の失敗と合わせて比較する。

## Capabilities

### New Capabilities

- `ci-budget-clock-diagnostics`: 実時間と予算上の時間を分けて期限試験の結果を調べる。

### Modified Capabilities

なし。製品runtime、既存試験の期待値・期限・猶予・再試行、品質設定は変更しない。

## Impact

対象はscripts/test-phase-profile.mjs、push・create試験の計測箇所、既存計測workflowの明示的な有効化、追加試験と説明文書。PR #120を土台にした別ブランチで進める。npm導入の削減とActionsサマリの追加は今回の範囲に含めない。
