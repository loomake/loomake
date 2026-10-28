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

## PR #107 のレビューへの対応（19:40）

- やったこと：rrr-www と Codex が同じ P2 を指摘した（`scripts/package-smoke.mjs` の 87 行）。2 つの待ち手 A と B が同じ古いロックを見て、B が取り直して中の処理に入ったあとに、A が B の有効なロックを `moved` へ移すと、空いた `lockDir` を C が取り、B と C の build と pack が重なる。C がまだ持っていれば、A は戻せずに B のロックを消す。rrr-www は 3 つのプロセスの試験で再現している。
  - 直し方：古いロックを消したり移したりして取り直すやり方をやめた。ロックを世代ごとのファイル（`.loomake/build-lock/1.owner`、`2.owner`…）で表し、いちばん新しい世代の持ち主がロックを持つ。その世代が解放済み（`N.released` がある）か、持ち主のプロセスが終わっているか、取ってから 10 分を過ぎたときは、次の世代のファイルを作って取る。作るときは、中身を書き終えた一時ファイルを世代の名前へハードリンクする。リンクは名前が空いているときだけ成功するので、同じ世代を取れるのは 1 つのプロセスだけになる。ほかのプロセスのロックを取得の経路から外す操作がなくなったので、回収用の 2 つ目のロックも要らない。
  - 順序の確かめ：A と B が同じ古い 1 世代目を見て、B が先に 2 世代目を作ると、A のリンクは EEXIST で失敗する。A は読み直して B の 2 世代目を見つけ、B が動いている間は待つ。C も同じく待つ。B が終わって `2.released` を書いたあとは、A と C のうち 3 世代目を作れた 1 つだけが進む。readdir のあとで古い世代が消えたときは、読み直す。消すのは自分の世代より古いものだけで、新しい世代を作ったあとに消すので、古い世代しか見えない待ち手が作ろうとする次の世代はすでにあり、その待ち手のリンクは失敗する。中身を読めない世代は、持ち主が動いているものとみなして待つ。期限（10 分）を過ぎたロックは持ち主が動いていても取り直すので、10 分を超える build とは重なり得る。これは前の版と同じ。
  - Vitest の globalSetup で build を 1 回にする案は採らなかった。dist を使わない試験ファイルを 1 つだけ流すときにも build が動き、試験の外の build はやはり防げないため。
  - 試験：`tests/package-smoke-lock.test.ts` に、レビューの順序を同期点で固定した試験を足した。死んだ持ち主の 1 世代目を置き、A を次の世代を作る直前で止める。B を取り直させて中の処理で止め、A を進めて取れなかったことを確かめる。そのあと C を起こして待たせ、そこまで中の処理に入ったのが B だけであること、最後に 3 つの処理が重ならなかったことを確かめる。同期点はファイルで受け渡し、時間には頼らない。失敗したときは、止まったままの子プロセスを終わらせる。リンクの代わりに上書きで世代を書くよう試しに壊すと、この試験は落ちた。ほかの試験も新しい形に合わせた。
- verify の結果：change がないので verify は実行していない。手元（Linux）で `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test`（76 ファイル、1089 件成功・8 件 skip）が通った。`tests/ai-journeys.test.ts` と `tests/package-artifacts.test.ts` だけを同時に流しても通った。
- 残っている確認事項・仮定：Windows と macOS では手元で試していない。CI で確かめる。ハードリンクは NTFS と、macOS・Linux の通常のファイルシステムで使える前提にしている。
- 次にやること：レビューの 2 つのスレッドに返信し、Codex に再レビューを頼む。マージの判断は利用者に委ねる。

## ロックをやめ、build と pack を試験の前に 1 回だけにする（19:55）

- やったこと：Codex が 775d526 に新しい P2 を出した（`scripts/package-smoke.mjs` の 119 行）。A が解放済みの 1 世代目を見て 2 世代目を作る直前で止まる。その間に B が 2 世代目を取って解放し、C が 3 世代目を取って `2.owner` を消すと、A は `2.owner` を作り直せてしまい、C が中にいる間に A も入る。ロックを直すたびに別の順序の不具合が見つかるので、調整役の指示で、古いロックの回収が要らない形に切り替えた。
  - 直し方：ロックのコードと `tests/package-smoke-lock.test.ts` を消した。`vitest.config.ts` を 2 つのプロジェクトに分けた。`package` には配布物を使う `tests/ai-journeys.test.ts` と `tests/package-artifacts.test.ts` を、`unit` にはそれ以外を入れる。`package` の globalSetup（`tests/package-build.setup.ts`）が、試験を始める前に `pnpm -r build` と 5 パッケージの `pnpm pack` を 1 回だけ動かし、tarball の場所を `provide` で渡す。2 つの試験はその場所を `LOOMAKE_PACKED_TARBALLS` で `prepare` に渡す。`prepare` は、この環境変数があれば tarball を写すだけで、build も pack もしない。なければ前と同じく build と pack をするので、CI の `package-smoke.mjs prepare` の手順は変わらない。これで、1 回の試験の中で build が重なることはなくなる。
  - プロジェクトを分けたのは、`package` の試験を含まない実行では build を動かさないため。`tests/doc-links.test.ts` だけを流しても build は動かなかった（runner の dist を消して確かめた）。
  - 試験の期待値と中身は変えていない。2 つの試験で変えたのは、子プロセスに渡す環境変数だけ。`vitest.config.ts` の変更は試験を流す構成の変更で、試験を緩めるものではない。カバレッジの閾値も変えていない。
  - CI のシャード（quality の 1/2・2/2）は、それぞれ `package` の試験を含むときだけ globalSetup を動かす。
- verify の結果：change がないので verify は実行していない。手元（Linux）で `pnpm -s lint`・`pnpm -s typecheck` が通った。`pnpm -s test` は 75 ファイル、1083 件成功・8 件 skip（消したロックの試験の 1 ファイル 6 件のぶん減った）。`--shard=1/2` は 38 ファイル 462 件、`--shard=2/2` は 37 ファイル 621 件成功・8 件 skip で、合わせると全体と同じ。`pnpm test --coverage` も閾値を超えて通った（文 94.87%・分岐 89.97%・関数 97.01%・行 97.96%）。環境変数なしの `node scripts/package-smoke.mjs prepare` も通った。
- 残っている確認事項・仮定：試験の外の build（同じ作業ツリーで別の作業が動かす `pnpm verify` など）が試験と重なれば、同じ失敗が起こり得る。Windows と macOS は CI で確かめる。
- 次にやること：2 つの P2 のスレッドに返信し、Codex に再レビューを頼む。マージの判断は利用者に委ねる。
