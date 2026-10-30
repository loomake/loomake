# 設計と再現の根拠

対象は main `d5aa30d`、計画の対象は PR #157 の head `86d5842`。設計の依頼は、終了コード 0 のエンジンが差分を残さなくても tasks.md のチェックだけで完了コミットができ、完了ゲートの直しでも差分なしの呼び出しが上限まで続く、という観測に基づく。

再現は、通常の runner 試験用 change を用意し、偽のエンジンが何も書き換えずに正常終了する台本で行う。修正前は tasks.md だけのタスク完了コミットが増え、既定の直し 5 回を含めて呼び出しが続く。修正後は最初の呼び出しで終了コード 1 となり、タスクは未完了でコミットが増えないことを確かめる。実行用の元の台本は Git 除外対象の `.loomake/repro/run.mjs` にある。追跡できる回帰試験は `packages/runner/test/run-no-change.test.ts` に残す。

原因は `packages/runner/src/run/phases.ts` の `runEngineTasks` が `guard()` 後に差分を調べず `checkTask()` と commit を行うことと、`runGate` が差分なしでも次の verify へ戻ることである。差分は `findViolations()` が `git add -A` した index を使い、run 自身のチェックを付ける前に調べる。

設計は Claude Code の独立した Opus セッションで作成された。[既存設計レビュー](https://github.com/loomake/loomake/pull/157#issuecomment-6512610409) の仕様整合・記録・fixture・変異試験名の指摘を計画へ反映する。保存ログ全文や秘密情報は公開しない。
