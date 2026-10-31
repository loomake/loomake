# Tasks

## 1. 仕様

- [x] 1.1 proposal・trace と差分仕様（REQ-344・REQ-345、MODIFIED REQ-214）を書き、設計担当の採否（Q-01〜Q-04）と仮定を trace.md に記録する（確認：`pnpm -s verify --change stabilize-cross-os-tests --spec-only` が exit 0）

## 2. 隔離一覧

- [x] 2.1 `tests/quarantine.json`（Issue #116・#178・#181・#183 の 6 ファイル、期限 2026-11-14）と `scripts/ci-quarantine.mjs`、`tests/ci-quarantine.test.ts` を足す（REQ-344）

## 3. CI の組み込み

- [x] 3.1 `.github/workflows/ci.yml`：macOS・Windows のシャードで一覧を検査し、除外するファイルをテストのステップに渡す。`vitest.config.ts` で受け取る。`.github/workflows/quality-quarantine.yml` を足す。静的検査の試験を足し、[REQ-214] の試験の条件の一覧を直す（REQ-214・REQ-344）

## 4. 心拍

- [x] 4.1 `scripts/ci-heartbeat.mjs` と ci.yml・quality-quarantine.yml への組み込み、`tests/ci-heartbeat.test.ts`（REQ-345）

## 5. 段階の記録

- [x] 5.1 PR #179（head 3571c20）の診断を取り込む：`packages/runner/test/process-diagnostics.ts`・`publication-retry.test.ts` の段階の記録・`tests/publication-retry-diagnostics.test.ts`・`docs/dev/test-phase-profiling.md`。専用ワークフローは作らない
- [x] 5.2 `tests/package-artifacts.test.ts` と `scripts/package-smoke.mjs` に prepare・check・照合の段階の記録を足す。assertion は変えない（REQ-345）

## 6. 文書と確認

- [x] 6.1 `docs/dev/ci.md` に隔離の手順を書く。changeset は空にする
- [x] 6.2 試験の上限・assertion・skip の数が変わっていないことを `git diff origin/main -- tests packages/*/test` で確かめ、`pnpm -s verify --change stabilize-cross-os-tests --done` を通す
