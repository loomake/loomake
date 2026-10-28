# 2026-10-28 の作業記録（windows-test-timeouts）

## Windows で時間切れしやすいテストの上限を延ばす（Issue #5）（09:55）

- やったこと：change なし。Windows の quality の 2 シャードが必須チェックになった（09:13）ため、ときどき時間切れで落ちて関係のない PR を止めるテストの時間の上限を、Windows でだけ延ばした。利用者が 2026-10-28 に「おすすめで」と答えて、テストの設定を緩める変更を承認している。期待値とテストの中身は変えていない。ubuntu・macOS の上限も変えていない。
  - 対象の選び方：main の Windows の run 4 回分（40603707075・40603733535・40605144362・40606467906）のログから、所要時間が 3000ms を超えるテストを集めた。そのうち、ファイルにも個々のテストにも上限の指定がなく、既定の 5000ms で動いているものを対象にした。
  - `tests/input-boundaries.test.ts`：実際の run を動かす 5 件（REQ-172 の「過大なtasks」と「通常runでも過大な trace.md・tasks.md・specs/x/spec.md」の 3 件、REQ-173 の「通常runで巨大な検証失敗」）。Windows で最大 4416ms かかり、PR #31 の run では REQ-172 の trace.md が 5247ms で時間切れした。Windows でだけ 15000ms にした。
  - `tests/ci-gate-process.test.ts`：すべてのテストが git とゲートの子プロセスを起動する。Windows で 1.3〜4.9 秒かかり、最大は 4903ms だった。ファイル全体の上限を、Windows でだけ 15000ms にした。
  - #40 で Windows だけ skip した REQ-173 の「通常runで巨大な検証失敗を指示へ加える前に止まり、エンジンを起動しない」を、`it(` に戻した。
  - REQ-140 の「初回の検証成功を確認した後、2回目を停止して時間切れを記録する」は skip のまま残した。このテストの上限はすでに 20000ms で、失敗した run 40485476247 でも 7561ms で終わっている。失敗の中身は checkpoint のファイルがないことで、テストの中の `withProcessBudget({ timeoutMs: 6000 })` の予算を、Windows では 2 回目の品質コマンドより前に使い切ったと見ている。テストの上限を延ばしても直らない。
  - 3000ms を超えたほかのテストは、ファイルの `vi.setConfig({ testTimeout: 60_000 })` か、個々のテストの上限の指定がすでにあるので対象にしなかった。process-startup.test.ts の失敗は製品の時間の上限によるもので、テストの上限とは関係がない。REQ-181〜183 の 4 件は PR #22 の担当なので触っていない。
  - gate の扱いは #40 と同じにした（空の changeset と、PR 本文の `loomake-change: none`）。
- verify の結果：change がないので verify は実行していない。`pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` は手元（Linux）で通った。
- 残っている確認事項・仮定：REQ-140 の Windows の失敗は、予算の 6000ms が足りないためと見ているが、Windows で確かめていない。直すにはテストの中の予算を変えることになり、今回の承認の範囲（テストの時間の上限）を超える。
- 次にやること：PR の CI を見届け、Windows の 2 シャードを合わせて 3 回流して通るかを確かめる。Issue #5 に結果をコメントする。
