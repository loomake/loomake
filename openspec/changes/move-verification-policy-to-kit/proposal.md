# Proposal

## Why

WBS v1.4 の J04 は、判定を core から kit へ移し、core をモデルと解析の契約に絞ると決めている。現在の REQ-148・149 と実装は core での公開を要求しているため、C-001 の品質判定を足す前に移管部分をそろえる。

## What Changes

- REQ-148・149 の公開元を kit に改訂し、既存の判定関数と結果型を移す。
- **BREAKING**：core の公開 API から `evaluateAgreement`・`evaluateTestCoverage` と結果型を外す。利用側は kit から読む。J04 に従い互換期間は設けない。
- 既存のテストの期待値、mutation 検査の13条件と検出の基準を保って移管先へ追従する。
- 4値判定・新しい verify JSON・quality.yaml の読み込みは後続作業とし、この change で W1-4 全体を完了とはしない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `verification-policy`：合意判定とテスト対応判定を kit から公開する。

## Impact

core のモデル変換（REQ-147）は残す。kit の verify、判定のテスト、domain-mutations の複製・変異対象、公開 API の検査と利用者向け移行説明が影響を受ける。依存パッケージは追加しない。
