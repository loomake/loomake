# Design

## Context

Issue #5 の調査（2026-10-25T21:17 のコメント）で、Windows の quality で落ちるテストの原因を 6 つに分けた。2026-10-25T21:43 のレビューは change A・B・C に分ける進め方と、②のリンク名・⑤の待ち時間の変更に着手してよいと判断した。③は、引用を外す対象を固定の裸のコマンド名 `pnpm`・`npm` に限ることを条件とした。①については、36 行目の否定の検査が CRLF で常に通るという説明の誤りを指摘した。これは実装やマージの承認ではない。

## Decisions

### ① ワークフローの改行

`read()` で `.replace(/\r\n/g, '\n')` を通す。tests/monorepo.test.ts 13 行目の `readLf` と同じ書き方にする。理由は、`\n` を直接書いた正規表現（32・43・77 行目）が CRLF に合わないことだけとする。

36 行目の `not.toMatch(/^\s+(contents|id-token): write$/m)` は、CRLF でも働いている。JavaScript の `m` フラグの `$` は `\r` の前でも一致するので、`/^\s+(contents|id-token): write$/m.test("permissions:\r\n  contents: write\r\n")` は `true` になる。Issue のコメントにあった「中身に関係なく通る」は誤りだったので、改行をそろえる理由に入れない。

`.gitattributes` で LF に固定する案は採らない。利用者の Windows の作業ツリーの改行まで変わり、テストの前提の問題をリポジトリの設定で隠すことになるためである。

### ② リンク先のないフック

REQ-204 のテストは、`.git/hooks` の中にリンク先のないシンボリックリンクがあっても、run の git の設定とフックの比較が落ちずにタスクを完了にすることを確かめる。リンクを `pre-commit` の名前で置くと、Git for Windows はテストの準備のコミット（guards.test.ts の `runWith` の中）でそのリンクを実行しようとして `cannot spawn .git/hooks/pre-commit` で失敗し、製品のコードまで届かない。

リンクの名前を `missing-link` にする。git はこの名前をフックとして実行しない。f535fd2 の guards.ts は `.git/hooks` の中を名前によらず全件たどり、`lstatSync`・`readlinkSync` でリンクを扱うので、名前を変えても、リンク先のないリンクを比較で扱う検査として変わらない。リンクを作ることと、3 つの expect は残す。

### ③ 配布物の準備のコマンド名

scripts/package-smoke.mjs の `run()` と scripts/ai-journeys.mjs の `execute` は、Windows で `pnpm`・`npm`・`.cmd` を `shell: true` で起動し、コマンド名と引数を引用符で囲む。pnpm 12 の `pnpm.CMD` は `%~dp0` を使い、引用符で囲んだ名前を PATH から起動すると `%~dp0` がバッチの場所にならない（Issue の調査からの推定）。

コマンド名が固定の裸の名前 `pnpm`・`npm` のときだけ、コマンド名を囲まない。`.cmd` で終わる実行パス（node_modules/.bin/loomake.cmd の絶対パスなど）は空白を含みうるので、今までどおり囲む。引数も今までどおり囲む。2 つのスクリプトの `quote` は書き方が違い（package-smoke は Windows のときだけ囲む）、共用にすると ai-journeys から package-smoke への依存の形が変わるので、それぞれのファイルの中で直す。

### ⑤ 二重起動の待ち時間

REQ-158 のテストの `vi.waitFor(() => expect(repo.calls()).toHaveLength(1))` に `{ timeout: 30_000, interval: 50 }` を渡す。Windows では run の開始から最初の `gh auth status` まで約 1.4 秒かかり、既定の 1 秒を超える。エンジンの偽物は 10 秒眠るので、30 秒の待ちは先の実行が終わる前に二重起動を試すという意図を変えない（エンジンが呼ばれた時点で待ちは終わる）。テストの時間の上限はファイルの `vi.setConfig({ testTimeout: 60_000 })` に収まる。

## 差分仕様

この change は製品の振る舞いを変えない。それでも verify の仕様ゲートは差分仕様を必要とするので、過去にテストやコードの構成だけを決めた change（layer-kit-modules の REQ-207）にならい、守る前提を Requirement として足す。置き場所は 3 つの OS での CI（REQ-049）を定めている monorepo にする。直したテストは Windows の CI でこの前提を確かめるので、名前に [REQ-236] を足す。Linux と macOS では、同じテストが今までどおり通ることを確かめる。

## Risks and limits

- ③の `%~dp0` の仕組みと、②の Git for Windows の振る舞いは、Issue の調査での推定である。手元は Linux なので、Windows で通るかは PR の CI で確かめる
- change A だけでは Windows の quality は成功しない。④と⑥の失敗は残る。PR の Windows の失敗は直近の main の run とテストごとに照合する
