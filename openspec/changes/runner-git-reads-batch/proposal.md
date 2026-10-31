# Proposal: runner-git-reads-batch

## Why

run の試験の遅さと、macOS・Windows の時間切れの主な原因は、外部操作 1 回ごとに node の監視役を起動する固定費である（設計メモ `.loomake/handoff/design-b1-runner-tests-2026-10-31.md` の 0 章・3 章）。1 回の run で最も多い操作は `git rev-parse` で、run の試験 5 ファイルの監視つき操作 5,129 回のうち 39% を占める。この change では、同じ段階の境目で別々に起動している `git rev-parse` を 1 回の呼び出しにまとめ、操作の回数を減らす。Issue #116・#178（Windows の時間切れ）と #199（macOS で 500ms の操作期限に当たった失敗）で、負荷の元を減らすことがねらいである。

設計メモの 4.3 節 G1 と 5.2 節の PR 5 にあたる。Q-B1-4 の決定 b のとおり、stabilize-cross-os-tests の後続（A-06）とは別の change にする。後続の change からはこの change を参照するだけにする。

## What Changes

- `packages/runner/src/git.ts` に、HEAD の SHA・ブランチ名と、必要なら `--git-path config`・`--git-path hooks` を 1 回の `git rev-parse` で読む補助を足す。HEAD のコミットがない場合などで 1 回の呼び出しが失敗したときは、今と同じ別々の呼び出しに戻して、今と同じ値を返す。
- `packages/runner/src/guards.ts` の `headState`・`gitInternals` をこの補助で読む。エンジンを呼ぶ前の読み取りは `rev-parse` 4 回と `config --list` 1 回から、`rev-parse` 1 回と `config --list` 1 回になる。呼んだ後は `rev-parse` 2 回と `config --list` 1 回から、`rev-parse` 1 回と `config --list` 1 回になる。
- `packages/runner/src/run/phases.ts` の完了ゲートの前後の読み取り（`headState`）を、それぞれ `rev-parse` 2 回から 1 回にする。
- 読み取りは今と同じ時点で行う。段階の境目（エンジンの前・後、完了ゲートの前・後）ごとに読み直し、前の境目で読んだ値を次の境目で使い回さない。

- run-guards に「段階の境目ごとの Git の読み取り」と「まとめた Git の読み取りの失敗」（どちらも REQ-348）を足す。境目ごとの `git rev-parse` を 1 回にし、境目をまたいで値を使い回さないことを、試験で確かめられる約束にする。

既存の Requirement（REQ-126・REQ-198・REQ-204・REQ-205・REQ-180〜REQ-183・REQ-158・REQ-137）は変えず、満たしたまま外部操作の回数だけを減らす。比べる値・比べる時点・止まる条件・表示する文・終了コードは変えない。すべての git の操作は、今までどおり監視役を通して期限に入れる。

## Non-goals

- `git config --list --show-origin -z` の回数は減らさない。REQ-204 は、git が実際に使う設定をエンジンの前後で比べることを求めており、1 つの境目で 1 回ずつが下限である。
- ロック（`git rev-parse --absolute-git-dir`、REQ-158）は、run の準備の読み取りとまとめない。ロックを取る前に HEAD を読むと、先に動いていた run が HEAD を変えた場合に古い値を使うおそれがある。
- 準備の `--abbrev-ref HEAD` と、change のブランチがあるかの確かめ（`--verify --quiet refs/heads/<branch>`）はまとめない。`--verify` は引数を 1 つしか受け付けず、まとめるとブランチがない場合と HEAD のコミットがない場合を見分けられなくなる。減るのは 1 回の run で 1 回だけである。
- `loomake trace record`（`packages/trace/src/record.ts`）の `rev-parse HEAD` と `show -s --format=%cI HEAD` はまとめない（Q-01）。
- 試験の期待値・上限時間・数・`it.each` の値は変えない。試験の側の改善（設計メモの T1〜T4・P1）と、#199 の試験の操作期限（Q-B1-1）は別の PR で扱う。
- Windows で正常終了のあとの `taskkill /T` を省く案（設計メモ G2）と、予算の時計を注入する案（C1）は扱わない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `run-guards`：「段階の境目ごとの Git の読み取り」「まとめた Git の読み取りの失敗」（REQ-348）を足す。既存の Requirement は変えない。

## Impact

`packages/runner/src/git.ts`・`packages/runner/src/guards.ts`・`packages/runner/src/run/phases.ts` と、`packages/runner/test/` の試験（補助の単体試験の追加と、ガードの試験の追加）を変える。公開 API・CLI の出力・JSON の版・依存の境界は変えない。配布物の振る舞いは変わらないので、changeset は patch（runner の内部の効率化）とする。
