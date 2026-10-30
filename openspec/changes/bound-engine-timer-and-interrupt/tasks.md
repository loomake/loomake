# Tasks

## 1. 仕様

- [x] 1.1 proposal・design・trace と差分仕様（REQ-336・REQ-337）を書き、`pnpm -s verify --change bound-engine-timer-and-interrupt --spec-only` を通す

## 2. エンジンのタイマー（REQ-336）

- [x] 2.1 `packages/runner/test/engine-long-deadline.test.ts` に 3 つの試験（runClaude の上限超え・分けた待機の早い発火・timeoutMinutes 40000 の run）を足す。実装の前に実行し、3 つとも失敗することを PR に記録する（REQ-336）
- [x] 2.2 `engine.ts` の期限の待機を、上限以下に分けて計り直す形にする。2.1 の試験と、既存の `engine-safety`・`engine-normal-exit`・`run.test` の REQ-105 の試験が通ることを確かめる（REQ-336）

## 3. 外部操作のあいだの中断（REQ-337）

- [ ] 3.1 `external-budget.test.ts` の、監視役へ信号を送るスクリプトを、信号を引数に取る形で `helpers.ts` へ移す。`external-budget.test.ts` の REQ-183・REQ-250 の試験が期待値を変えずに通ることを確かめる（REQ-337）
- [ ] 3.2 `signal-during-sync.test.ts` に AC-4〜9（SIGINT・SIGTERM の commit、push、gh の検索・作成、commit の SIGKILL、品質コマンドの SIGKILL の後続あり・なし）を足す。実装前に AC-4・5・6・8 が失敗し、AC-7・9 が通ることを記録する（REQ-337）
- [ ] 3.3 `run/phases.ts` に `interruptedOperation` を足し、`run.ts` と `recordAndOpenPr` の catch で状態を選ぶ。AC-4〜7 が通り、AC-8・9 が失敗することを記録する（REQ-337）
- [ ] 3.4 kit の `process.test.ts` に AC-11 を足す。理由つきの中断の後続拒否で理由が消える試験が実装前に失敗し、利用者の中断の後続拒否は理由を持たない試験が通ることを記録する（REQ-250・REQ-337）
- [ ] 3.5 `process.ts` の共有予算へ最初の reason を保持し、後続の拒否へ引き継ぐ。AC-1〜11 と既存の期限・中断の試験が通ることを確かめる（REQ-250・REQ-337）
- [ ] 3.6 復旧ガイドの「端末を閉じたときとコンテナを止めたとき」に git・gh 中の中断の記録を書き、yomiyasu で推敲する（REQ-337）

## 4. 記録

- [ ] 4.1 この change の Scenario のレビューを `docs/quality/scenarios.json` に足す。根拠のテストファイルを変えた既存のレビューは、読み直してハッシュを更新する。`node scripts/scenario-audit.mjs` で reviewed になることを確かめる
- [ ] 4.2 `@loomake/kit`・`@loomake/runner`・`loomake` の patch の changeset を足す

## 5. 確認

- [ ] 5.1 `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` を通す
- [ ] 5.2 `pnpm -s verify --change bound-engine-timer-and-interrupt --done` を通す <!-- loomake:gate=done -->
