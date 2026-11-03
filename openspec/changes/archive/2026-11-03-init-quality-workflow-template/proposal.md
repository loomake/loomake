# Proposal

## Why

[#67](https://github.com/loomake/loomake/issues/67)のinitにはquality.yaml v2雛形と案件側の薄workflowがなく、[#359](https://github.com/loomake/loomake/issues/359)ではquality不在の2行案内だけで完了できない点も見つかった。[本人指定](https://github.com/loomake/loomake/issues/121#issuecomment-6591671700)に従い、両件を1 changeで扱う。

## What Changes

- 目標未設定のquality.yaml v2雛形と、自動実行されない4ジョブworkflow見本を配置する。Q-I67359-01/02は本会話で利用者が両方Aと直接回答した。quality不在時の案内では、読取りの最小と合格に必要な対象・証拠を区別する。
- 元の配置・ファイル保護・読取互換・空対象と証拠不足の拒否を保持する。REQ-396/397をinit、REQ-398をverifyへ追加する。既存Opus設計の配置・保護・案内の技術案を、本人回答A/Aの範囲で採用する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `init`: 目標未設定のquality雛形と自動実行されない4ジョブ見本を配置する。既存REQ-020の保護を継続する。
- `verify`: 読取りの最小とdoneに必要な対象・証拠を分けて案内する。REQ-310/314/319の挙動は保持する。

## Impact

対象はkitのinit/quality-input・配布テンプレート、CLI/kit/配布物試験、導入文書。公開API・依存・既存commands・設定・規約は変えない。製品実装は仕様ゲート成功後の作業とする。
