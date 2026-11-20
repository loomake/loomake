# Tasks

## 1. 計画

- [x] 1.1 REQ-451 の仕様・trace を作り、`pnpm -s verify --change protect-verify-output --spec-only` を通す。

## 2. kit

- [x] 2.1 品質コマンドと openspec validate の出力を、全文置換してから切る（REQ-451）。
- [x] 2.2 progress・戻り値（assemble・aborted・早期 aborted）・formatVerifyResult を置換する（REQ-451）。

## 3. cli

- [x] 3.1 共通のエラー表示と verify の標準エラーを置換する（REQ-451）。

## 4. 検証

- [ ] 4.1 全 Scenario と要件対応テストを確認し、changeset を追加して `pnpm -s verify --change protect-verify-output --done` を通す。
