# validate-specs-in-ci

## Why
2026-10-23 に fix-evaluation-findings と guard-test-weakening を archive したとき、反映後の Requirement の本文が 500 字を超え、`openspec validate --specs --strict` が失敗した（作業記録 2026-10-23 の 45 節）。CI の gate ジョブは change を 1 つずつ `verify --change <id> --done` で検査するだけなので、change の差分仕様を反映したあとの、いまの仕様の誤りには気づけない。

## What Changes
- CI の gate ジョブで、いまの仕様（`openspec/specs/`）に `openspec validate --specs --strict` を実行し、失敗したらジョブを失敗させる（REQ-010）

## Non-goals
- `loomake verify` の仕様ゲートで、change の差分仕様を反映したあとの仕様を検証すること
- archive の手順の変更

## Impact
- 影響する capability：monorepo（Requirement の変更）
- 影響するファイル：`.github/workflows/ci.yml`
