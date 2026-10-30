# Tasks

## 1. 仕様

- [ ] 1.1 proposal・design・trace と差分仕様（REQ-336・REQ-337）を書き、`pnpm -s verify --change bound-engine-timer-and-interrupt --spec-only` を通す

## 2. エンジンのタイマー（REQ-336）

- [ ] 2.1 `packages/runner/test/engine-long-deadline.test.ts` に 3 つの試験（runClaude の上限超え・分けた待機の早い発火・timeoutMinutes 40000 の run）を足す。実装の前に実行し、3 つとも失敗することを PR に記録する（REQ-336）
- [ ] 2.2 `engine.ts` の期限の待機を、上限以下に分けて計り直す形にする。2.1 の試験と、既存の `engine-safety`・`engine-normal-exit`・`run.test` の REQ-105 の試験が通ることを確かめる（REQ-336）

## 3. 外部操作のあいだの中断（REQ-337）

- [ ] 3.1 `external-budget.test.ts` の、監視役へ信号を送るスクリプトを、信号を引数に取る形で `helpers.ts` へ移す。`external-budget.test.ts` の REQ-183・REQ-250 の試験が期待値を変えずに通ることを確かめる（REQ-337）
- [ ] 3.2 `signal-during-sync.test.ts` に、commit 中の SIGINT・push 中の SIGINT・commit 中の SIGKILL の 3 つの試験を足す（POSIX だけ）。実装の前に、前の 2 つが失敗し、SIGKILL の 1 つが通ることを PR に記録する（REQ-337）
- [ ] 3.3 `run/phases.ts` に `interruptedOperation` を足し、`run.ts` の catch と `recordAndOpenPr` の catch で状態を選ぶ。3.2 の試験と、既存の REQ-124・REQ-137・REQ-182・REQ-208 の試験が通ることを確かめる（REQ-337）
- [ ] 3.4 `docs/guide/2.guides/3.run-recovery.md` の「端末を閉じたときとコンテナを止めたとき」に、git・gh の実行中の中断も interrupted と記録することを書き、yomiyasu で推敲する（REQ-337）

## 4. 記録

- [ ] 4.1 この change の Scenario のレビューを `docs/quality/scenarios.json` に足す。根拠のテストファイルを変えた既存のレビューは、読み直してハッシュを更新する。`node scripts/scenario-audit.mjs` で reviewed になることを確かめる
- [ ] 4.2 `@loomake/runner` と `loomake` の patch の changeset を足す

## 5. 確認

- [ ] 5.1 `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` を通す
- [ ] 5.2 `pnpm -s verify --change bound-engine-timer-and-interrupt --done` を通す <!-- loomake:gate=done -->
