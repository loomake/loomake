# 合意した品質 YAML の適用と合意対象外の保持

## Why

具体的に合意した品質案を反映し、合意対象外の既存内容を保つ必要がある。元 B2 の適用・保持と報告を別の機能 PR に分け、要件・試験・設計方式を保ったまま全量を抑える。

## What Changes

- 元 REQ-410 の四 Scenario を同じ ID・本文で移管し、Step 5 の適用・保持だけを追加する。
- 合意した既存値・ID の更新を許し、合意対象外の値・コメント・未知キー・順序・ID を保持する。
- 予期しない衝突・読取不良は関連 Q へ残し、不在時は合意した全文を作る。結果報告は後続 Report に残す。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `req-to-openspec-skill`: 合意した品質 YAML の適用と保持を追加する。

## Impact

両 Skill の Step 5、両 format の保持例、元 root 三件・kit 一件の試験、guide に追加する。Step 7 の旧報告四項目と次の一手はそのまま保ち、runtime/API・parser/schema・依存・設定は変更しない。
