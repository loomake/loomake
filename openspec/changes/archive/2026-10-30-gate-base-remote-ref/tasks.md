# Tasks

## 1. 仕様

- [x] 1.1 proposal・trace と差分仕様（REQ-272）を書き、仕様ゲートを通す

## 2. 実装

- [x] 2.1 `tests/ci-gate-process.test.ts` に試験を足す。ベースと同じ名前のタグやブランチが PR のコミットの途中を指していても、リモートの追跡ブランチとの差分で change を選ぶことを確かめる（REQ-272）
- [x] 2.2 `scripts/ci-gate.mjs` の差分のベースを `refs/remotes/origin/${base}` にする。`scripts/` と `.github/workflows/` に、`origin/<base>` とだけ書いた差分のベースがほかにないことを確かめる（REQ-272）
- [x] 2.3 Scenario「同じ名前のタグやブランチがある」のレビューを、change 側の ID で `docs/quality/scenarios.json` に足す。`tests/ci-gate-process.test.ts` を根拠にする既存のレビューは、試験を読み直してハッシュを更新する。`node scripts/scenario-audit.mjs` で、この change の Scenario が reviewed になることを確かめる（REQ-272）

## 3. 確認

- [x] 3.1 `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` を通す
- [x] 3.2 `pnpm -s verify --change gate-base-remote-ref --done` を通す <!-- loomake:gate=done -->
