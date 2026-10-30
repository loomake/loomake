# Tasks

## 1. 仕様

- [x] 1.1 proposal・design・trace と差分仕様（REQ-330〜REQ-332）を書き、仕様ゲートを通す。確認事項 Q-01〜Q-03 の回答を trace.md に記録する（確認：`pnpm -s verify --change stop-on-empty-engine-diff --spec-only` が exit 0）

## 2. 判断

- [x] 2.1 `packages/runner/test/decision-policy.test.ts` に REQ-332 の `it.each` を足し、失敗することを確かめる（確認：`pnpm -s vitest run packages/runner/test/decision-policy.test.ts` で、新しい行だけが失敗する）
- [x] 2.2 `packages/runner/src/run/decision-policy.ts` に `decideAfterChanges` を足す（確認：2.1 の試験が通る）
- [x] 2.3 `tests/run-decision-mutations.test.ts` に変異 `repair-no-change`・`no-change-anchor` を足し、名前の数と結果の期待値を増やす（確認：この試験が通り、5 つの変異が killed になる）

## 3. run の流れ

- [x] 3.1 `packages/runner/test/run-no-change.test.ts` に REQ-330・REQ-331 の試験を書き、修正前に失敗することを確かめる（確認：設計の 4 章の 1・2・5・6・7 が失敗する）
- [x] 3.2 `phases.ts` の `callEngine` が本文を返すようにし、`runEngineTasks` で `guard` の後・`checkTask` の前に判断を呼ぶ。止まるときの表示と、変更なしの完了の表示（Q-03 の決定に従いコミット本文）を足す（確認：3.1 の REQ-330 の試験が通る）
- [x] 3.3 `runGate` の直しのあとの差分の判定を `decideAfterChanges` に置き換える（確認：3.1 の REQ-331 の試験が通る）
- [x] 3.4 `prompt.ts` で、タスクの指示だけに `LOOMAKE-NOCHANGE:` の決まりを足す（確認：3.1 の指示の試験が通る）
- [x] 3.5 `helpers.ts` に `noChange` を足し、runner の試験で、エンジンのタスクに当たる何も変えない台本を置き換える。REQ-100・REQ-111 の試験のタスクも置き換え、REQ-104 の試験は、直しでファイルを書く台本にする。期待値は変えない（確認：`pnpm -s vitest run packages/runner tests/input-boundaries.test.ts` が通り、`git diff` で `expect` の行が変わっていない）

## 4. 文書と記録

- [x] 4.1 `docs/guide/1.getting-started/2.usage.md` と `docs/guide/2.guides/3.run-recovery.md` に、合図と止まったときの対処を書く。yomiyasu で推敲する（確認：リンクと記述を読み直す）
- [x] 4.2 `docs/quality/scenarios.json` に、この change の Scenario のレビューを足し、台本を変えた試験を根拠にする既存のレビューのハッシュを更新する（確認：`node scripts/scenario-audit.mjs` で、この change の Scenario が reviewed になる）
- [x] 4.3 `@loomake/runner` と `loomake` の changeset を足す（確認：`pnpm changeset status`）

## 5. 確認

- [x] 5.1 `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` を通す。`.loomake/repro/run.mjs` で、コミットが増えずに終了コード 1 になることを確かめる
- [x] 5.2 `pnpm -s verify --change stop-on-empty-engine-diff --done` を通す <!-- loomake:gate=done -->

## 6. 最終レビュー後に確認した仕様との不一致

- [ ] 6.1 REQ-332 の直接試験と REQ-330 の統合試験を追加し、同一行の全角空白・NBSP に続く理由を修正前に拒否することを Red で確認する。改行を越えた別行の理由は拒否する試験も追加する
- [ ] 6.2 合図の区切りを同一行の空白に広げ、既存の期待値を維持して直接試験・統合試験・変異検査を通す。Scenario 対応と作業記録を更新し、既存の完了ゲート 5.2 を最終 head で再実行する。修正後の head は追加レビューの明示承認が得られるまで未レビューとする
