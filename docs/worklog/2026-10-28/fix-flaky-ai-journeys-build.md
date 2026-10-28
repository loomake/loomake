# 2026-10-28 の作業記録（fix-flaky-ai-journeys-build）

## 試験の中の build を 1 つずつ動かす（Issue #34）（19:20）

- やったこと：change なし。`tests/ai-journeys.test.ts` の中の `pnpm -r build` が、ときどき `packages/cli/src/main.ts` の TS7006 で落ちる件を直した。
  - 原因：`scripts/package-smoke.mjs` の `prepare` はリポジトリ直下の `packages/*/dist` に `pnpm -r build` で書き出す。これを呼ぶ試験は `tests/ai-journeys.test.ts` と `tests/package-artifacts.test.ts` の 2 ファイルで、Vitest は 2 つを別のワーカーで同時に動かすことがある。tsc は出力のファイルを空にしてから書くので、runner の build が `dist/run.d.ts` などを空にしている間に、もう一方の build の cli の tsc がそれを読むと、`RunOptions` が any になり、`confirm` の引数だけが TS7006 になる。Issue #34 のコメントで、.d.ts を空にすると同じエラーが出ることを確かめてある。
  - 直し方：Issue のおすすめの 1 にした。`prepare` の `pnpm -r build` から `pnpm pack` までを、`.loomake/build.lock` のディレクトリのロックで囲んだ（`withBuildLock`）。持ち主のプロセスが終わっているロックと、取ってから 10 分を過ぎたロックは外して取り直す。外すときは一意の名前に移してから、古いロックのままかを確かめるので、ほかの待ち手が取り直したロックは消さない。5 分待っても取れなければ失敗する。`main.ts` に型の注釈を付けるだけの直し方は、競合を残すので採らなかった。
  - 試験：`tests/package-smoke-lock.test.ts` を足した。4 つのプロセスが同時に取っても中の処理が重ならないこと、持ち主が終わったロックと期限を過ぎたロックを取り直すこと、動いている持ち主のロックは外さず待つ時間を過ぎたら失敗すること、中の処理が失敗してもロックを外すことを確かめる。製品の振る舞いは変えていないので、要件 ID は付けていない。
  - gate の扱いは #40・#43 と同じにした（空の changeset と、PR 本文の `loomake-change: none`）。仕様の Requirement は試験の中の build の進め方を定めていないので、change は作っていない。
- verify の結果：change がないので verify は実行していない。手元（Linux）で `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test`（76 ファイル、1088 件成功・8 件 skip）が通った。`tests/ai-journeys.test.ts` と `tests/package-artifacts.test.ts` だけを同時に 3 回流して、3 回とも通った。
- 残っている確認事項・仮定：もとの失敗は手元で再現できていない（Issue #34 の調査でも 0 回）。原因は「有力」の段階で、確定していない。試験の外の build（同じ作業ツリーで別の作業が動かす `pnpm verify` など）はロックを通らないので、重なれば同じ失敗が起こり得る。
- 次にやること：PR の CI を見届ける。マージの判断は利用者に委ねる。
