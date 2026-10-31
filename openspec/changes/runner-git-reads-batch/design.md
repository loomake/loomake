# Design: runner-git-reads-batch

## 背景と計測

基準は origin/main `b98c2e40`（PR #220 のマージ後）。計測は dev container（Linux、Node 24、git 2.56.0）で行った。

- 監視つき操作の数：`LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR` を指定して試験を流し、`supervisor-entry` を数えた（PR #218・#220 の診断の仕組み）。run.test.ts は 1,580 回（うち `git-rev-parse` 638 回、`git-config` 180 回）、guards.test.ts は 1,175 回（458 回、143 回）。設計メモ 1.1 節の値と一致する。
- 引数ごとの内訳：診断の記録には引数がないので、`GIT_TRACE` を指定して流し、`git rev-parse`・`git config` の引数ごとに数えた。試験の fixture の git（`repo.git(...)`）も入るので、製品の呼び出しと形が重ならない行だけを使う。
- 1 回の run の流れ：run.test.ts の「[REQ-096] loomake/<change-id> がなければ、いまの HEAD から作ってコミットする」1 件（エンジン 2 回、完了ゲート 1 回、証拠の記録と PR まで）で、監視つきの外部操作は 58 回だった。診断の記録の 53 回（git 48 回、gh 4 回、その他 1 回）に、診断の記録に入らない証拠の記録の git 5 回を足した数である（`trace record` は run の環境変数を渡さないので、診断の preload が入らない）。git のうち `rev-parse` は 21 回、`config` の読み取りは 5 回だった。

## 呼び出し元の一覧

| # | 段階 | ファイル・関数 | 引数 | 1 回の run での回数 | ガードの読み直しか |
|---|---|---|---|---|---|
| 1 | ロック | `lock.ts` `acquireRunLock` | `rev-parse --absolute-git-dir` | 1 | いいえ（REQ-158） |
| 2 | 準備 | `run/prepare.ts` `prepare` | `rev-parse --abbrev-ref HEAD`（startBranch） | 1 | いいえ |
| 3 | 準備 | `git.ts` `branchExists`（prepare から） | `rev-parse --verify --quiet refs/heads/<branch>` | 1 | いいえ |
| 4 | 準備の後 | `run.ts` `runLocked` | `config branch.<branch>.loomake-base <start>`（書き込み） | 0〜1 | いいえ（読み取りではない） |
| 5 | エンジンの前 | `guards.ts` `headState`（`callEngine` から） | `rev-parse --verify -q HEAD`、`rev-parse --abbrev-ref HEAD` | エンジン 1 回ごとに 2 | はい（REQ-126 の「呼ぶ前」） |
| 6 | エンジンの前 | `guards.ts` `gitInternals` → `gitPath` | `rev-parse --git-path config`、`rev-parse --git-path hooks` | エンジン 1 回ごとに 2 | はい（REQ-198 の場所） |
| 7 | エンジンの前 | `guards.ts` `gitInternals` | `config --list --show-origin -z` | エンジン 1 回ごとに 1 | はい（REQ-204） |
| 8 | エンジンの後 | `guards.ts` `findEngineMove` → `headState` | #5 と同じ 2 つ | エンジン 1 回ごとに 2 | はい（REQ-126 の「呼んだ後」） |
| 9 | エンジンの後 | `guards.ts` `findInternalsChange` → `gitInternals(…, before)` | `config --list --show-origin -z`（場所は呼ぶ前の値を使い、`--git-path` は読まない） | HEAD が変わらなかったとき 1 | はい（REQ-198・REQ-204） |
| 10 | 完了ゲートの前 | `run/phases.ts` `runGate` → `headState` | #5 と同じ 2 つ | ゲート 1 回ごとに 2 | はい（REQ-205 の状態の変化） |
| 11 | 完了ゲートの後 | `run/phases.ts` `runGate` → `headState` | #5 と同じ 2 つ | ゲート 1 回ごとに 2（中断で止まるときは 0） | はい（REQ-205） |
| 12 | PR の前 | `run/phases.ts` `recordAndOpenPr` → `gitConfig` | `config --get branch.<branch>.loomake-base` | 0〜1 | いいえ |
| 13 | 証拠の記録 | `trace/src/record.ts` `runRecord` | `rev-parse HEAD`（verify の前）、`show -s --format=%cI HEAD` | 0〜1 ずつ | はい（REQ-128 の「前」） |
| 14 | 証拠の記録 | `trace/src/record.ts` `runRecord` | `rev-parse HEAD`（verify の後） | 0〜1 | はい（REQ-128 の「後」） |

`findEngineMove` が HEAD の変化を見つけたときの `diff`・`status`、`reuse.ts` の `show -s --format=%P`・`diff` は `rev-parse`・`config` ではないので、この change の対象外とする。kit の `doctor` の `rev-parse --is-inside-work-tree` は run の外なので対象外とする。

## 境目と、各境目で読む項目

境目は「エンジンの前」「エンジンの後」「完了ゲートの前」「完了ゲートの後」の 4 種類で、読む時点は今と同じにする。

| 境目 | 今 | この change の後 | 読む項目 |
|---|---|---|---|
| エンジンの前 | `rev-parse` 4 回 + `config --list` 1 回 | `rev-parse` 1 回 + `config --list` 1 回 | HEAD の SHA、ブランチ名、`--git-path config`、`--git-path hooks`、git が使う設定 |
| エンジンの後 | `rev-parse` 2 回 + `config --list` 1 回 | `rev-parse` 1 回 + `config --list` 1 回 | HEAD の SHA、ブランチ名、git が使う設定。設定ファイルとフックの場所は「前」の値を使う（今と同じ） |
| 完了ゲートの前 | `rev-parse` 2 回 | `rev-parse` 1 回 | HEAD の SHA、ブランチ名 |
| 完了ゲートの後 | `rev-parse` 2 回 | `rev-parse` 1 回 | HEAD の SHA、ブランチ名 |

1 回の呼び出しの形は、たとえば次のとおりとする（最終的な引数は実装のタスク 2.1 で決め、単体試験で確かめる）。

```
git rev-parse [--git-path config --git-path hooks] HEAD --abbrev-ref HEAD
```

出力は 1 行に 1 項目で、`--git-path` を付けたときは先頭の 2 行が場所、続く 2 行が SHA とブランチ名になる。手元で確かめた結果：

- 通常：4 行（または 2 行）を出し、終了コード 0。detached のときブランチ名は `HEAD` で、今の `--abbrev-ref HEAD` と同じ
- 作業ツリーに `HEAD` という名前のファイルがあっても、終了コード 0 で同じ出力になる
- HEAD のコミットがない（unborn）：場所の 2 行と `HEAD` を出したあと、終了コード 128 で失敗する。今の `headState` は、この場合 `sha` を空、`branch` を `HEAD` にしている

このため、1 回の呼び出しが 0 以外で終わったときや、行の数が合わないときは、今と同じ別々の呼び出し（`--verify -q HEAD`、`--abbrev-ref HEAD`、`--git-path config`、`--git-path hooks`）に戻して値を求める。unborn の run は少ないので、回数への影響はない。期限や出力の上限で止まったとき（`ProcessLimitError`・`RuntimeFailure`）は今と同じく例外のまま上へ渡し、別々の呼び出しには戻らない。

## 読み直しの時点が変わらない根拠

- 「エンジンの前」の読み取りは、今と同じく `callEngine` の中で、エンジンを起動する直前に行う。`headState` と `gitInternals` の間には git もエンジンも動かないので、2 つを 1 回の呼び出しにまとめても、読む時点の違いは数 ms の範囲で、その間に作業ツリーを変えるものはない
- 「エンジンの後」の読み取りは、今と同じくエンジンが終わったあとに、成功・失敗・質問・時間切れ・中断のどれでも行う（REQ-126）。HEAD の変化を見つけたときに `config --list` を読まない順序（`phases.ts` の「HEAD変更を見つけた場合は、Git内部を追加で読まない」）も変えない
- 完了ゲートの前と後の読み取りは、今と同じく `runVerify` の直前と、中断の確認のあとに行う（REQ-205・REQ-208）
- ある境目で読んだ値を、次の境目で使い回さない。たとえば完了ゲートの後に読んだ HEAD を、続く直しのエンジンの前の値として使わない。どの境目も自分で読み直す
- まとめた呼び出しも `runExternal` を通るので、監視役・1 操作の期限・共有予算・出力の上限は今と同じにかかる（REQ-180〜REQ-182）
- 比べる値（SHA・ブランチ名・設定ファイルとフックの SHA-256）と、止まる理由・表示・終了コードは変えない

## 回数の前後の見込み

1 回の run で減る `rev-parse` の数は、エンジンの呼び出し回数を E、`headState` の呼び出し回数を H とすると、H + 2E になる（`headState` が 2 回から 1 回に、エンジンの前の `--git-path` 2 回が 0 回になる）。上の 1 件の run（E = 2、H = 6）では、`rev-parse` が 21 回から 11 回に、監視つきの外部操作が 58 回から 48 回（−17%）になる。

試験ファイルごとの見込みを次の表に示す [推測：`GIT_TRACE` の引数ごとの数からの計算]。

| ファイル | 監視つき操作（今）[実測] | H（`--verify -q HEAD` の数）[実測] | E（`--git-path config` の数）[実測] | 減る数 H + 2E | 割合 |
|---|---|---|---|---|---|
| run.test.ts | 1,580 | 181 | 62 | 305 | −19% |
| guards.test.ts | 1,175 | 120 | 50 | 220 | −19% |
| publication-retry.test.ts | 1,597 | 132 | 33 | 198 | −12% |
| pr.test.ts | 385 | 44 | 15 | 74 | −19% |
| external-budget.test.ts | 392 | 44 | 13 | 70 | −18% |
| 合計 | 5,129 | 521 | 173 | 867 | −17% |

設計メモ 4.3 節は「rev-parse と config を半分にして −25% 前後」と見込んでいた。`config --list` は REQ-204 のため境目ごとに 1 回が下限で減らせないので、見込みは −17% に下がる。

## 時間への効果 [推測]

- 手元（1 操作 約 15ms）：5 ファイル合計で 867 × 15ms ≒ −13 秒
- CI ubuntu（手元の 2.2〜3.4 倍）：−29〜−44 秒。設計メモの −60〜−90 秒より小さい
- Windows（1 操作 約 166〜238ms）：run.test.ts だけで 305 × 約 238ms ≒ −73 秒。隔離中の guards・pr・publication-retry では、1 件あたり数操作から十数操作が減り、60 秒の上限との差が広がる
- macOS（1 操作 約 138ms）：publication-retry.test.ts で 198 × 138ms ≒ −27 秒、guards.test.ts で 220 × 約 138ms ≒ −30 秒

#199 の失敗（external-budget.test.ts:148）は、gh の認証確認より前の git 1 操作が 500ms の期限に当たったものである。この試験の run は、認証確認より前の段階ではエンジンを呼ばないので、この change で減る操作は少ない。#199 の対策は Q-B1-1（操作期限の見直し）が主で、この change は負荷を下げる側から効くだけである。

実際の前後の数は、タスク 3.1 で同じ方法で数えて PR に書く。

## 仕様の差分

利用者から見た振る舞い（比べる値・時点・止まる条件・表示・終了コード）は変わらない。それでも REQ-348 を足すのは次の 2 つの理由による。

- 回数を減らすことがこの change の目的で、境目ごとの回数と「使い回さない」ことを試験で確かめる約束にしておかないと、後の変更で元に戻っても気づけない
- 仕様ゲートの「差分仕様」の検査は、差分仕様のない change を通さない

`config --list` を境目ごとに 1 回読むことは REQ-204 のままで、REQ-348 は回数の上限として書き直すだけである。

## 試験

- 新しい補助の単体試験：通常・detached・unborn・`HEAD` という名前のファイルがある場合に、今の `headState`・`gitPath` と同じ値を返すこと。`[REQ-348][REQ-126][REQ-198]` を名前に入れる
- ガードの試験：エンジンの前後で、`rev-parse` がそれぞれ 1 回ずつで、`config --list` もそれぞれ 1 回ずつであること（診断の記録か `GIT_TRACE` で数える）。HEAD の変化・ブランチの切り替え・設定とフックの変更を、今と同じく見つけること。`[REQ-348][REQ-126][REQ-198][REQ-204]`
- 完了ゲートの試験：検証のあいだに HEAD かブランチが変わったら、今と同じく止まること。直しのエンジンの前で HEAD を読み直すこと。`[REQ-348][REQ-205]`
- まとめた呼び出しが期限に達したときに、項目ごとの呼び出しを起動せずに止まること。`[REQ-348][REQ-180]`
- 既存の試験は期待値を変えずに通す
