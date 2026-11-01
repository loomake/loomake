# Proposal: classify-unchanged-archive-metadata

状態：UNAPPROVED。規則変更の提案であり、承認・実装・適用はしていない。

## Why

完了した change を archive するとき、保存が必要な `.openspec.yaml` の移動が文書以外の L2 と判定され、主仕様の同期を含む PR は L3 になる。内容を変えない通常ファイルの移動に限った例外を提案し、品質コマンドを省略する範囲の拡大について人の明示承認を求める。

## What Changes

- `REQ-362` として、R100・前後の完全な blob ID の一致・前後 100644・対応する archive 名・安全なパス・同じ archive への文書追加をすべて満たす移動だけ、前後のパスを L1 と数える案を追加する。
- `REQ-342` は L1 の対象の行だけを変更し、本文のほかの行と既存 13 Scenario を保持する。`.openspec.yaml` を一般の文書の許可リストには加えない。
- この案の採用後は、ほかの全パスが既存 L1 に当たる archive PR で、quality の lint・typecheck・test・build・配布物検査が省略され、対象 change がない gate は lint と文書リンク検査だけを実行する。main push の品質検査、主仕様 strict、REQ ID 重複検査、archive 前の元の DoD は維持する。
- AGENTS.md の L1 対象行へ最小の追記を提案する。未適用パッチを `proposed/AGENTS.md.patch` に置く。
- 任意の YAML、内容変更、単独の追加・移動、不一致・不正な日付・不安全なパス・通常以外のモード・OID 不明は例外にしない。ほかの未知パスは L2 のまま。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `monorepo`: archive の内容不変メタデータを限定して L1 と数える Requirement を追加し、段階判定の L1 行を参照先へ合わせる。

## Impact

対象候補は `scripts/ci-tier.mjs`・`scripts/ci-docs-only.mjs`・`scripts/ci-gate.mjs` と対応する 3 試験ファイル。AGENTS.md の実体、コード、主仕様、CI 設定、既存試験の期待値はこの提案作業では変更しない。

Q1 の明示承認後に、通常の L3 として仕様ゲート、追加試験の RED→GREEN、完了ゲート、3 OS と必須 CI、独立 Opus レビューを通す。main へ採用されたあとから archive に適用する。#260 の承認や過去の archive は本案の承認に流用しない。
