# Tasks

## 1. 仕様

- [x] 1.1 Issue #5 の調査とレビューから proposal・design・trace と monorepo の差分仕様を書き、仕様ゲート（`--spec-only`）を通す（REQ-236）

## 2. テストの前提

- [ ] 2.1 ① tests/release-security.test.ts の `read()` で、ワークフローの改行を LF にそろえる。`\n` を書いた正規表現を使うテストの名前に [REQ-236] を足す。期待値は変えない（REQ-236）
- [ ] 2.2 ② packages/runner/test/guards.test.ts の REQ-204 のテストで、リンク先のないリンクを `.git/hooks/missing-link` に置く。リンクを作ることと 3 つの expect は残し、名前に [REQ-236] を足す（REQ-236）
- [ ] 2.3 ③ scripts/package-smoke.mjs の `run()` と scripts/ai-journeys.mjs の `execute` で、固定の裸のコマンド名 `pnpm`・`npm` だけを引用符で囲まない。実行パスと引数は今までどおり囲む。tests/package-artifacts.test.ts と tests/ai-journeys.test.ts の、準備を実行するテストの名前に [REQ-236] を足す（REQ-236）
- [ ] 2.4 ⑤ packages/runner/test/run.test.ts の REQ-158 のテストで、`vi.waitFor` に `{ timeout: 30_000, interval: 50 }` を渡す。二重起動と中断後のロックの解放の検査は残し、名前に [REQ-236] を足す（REQ-236）

## 3. 確認

- [ ] 3.1 changeset（配布するパッケージは変えない）と作業記録を足す
- [ ] 3.2 `pnpm -s verify --change fix-windows-test-assumptions --done` を通す <!-- loomake:gate=done -->
