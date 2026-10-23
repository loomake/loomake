# run Specification

## Purpose
`loomake run` が change の tasks.md を AI のエンジンに実装させ、完了ゲートが通るまで回すときの振る舞いを定める。実行前の確認、ブランチ、タスクを 1 つずつ渡すこととコミット、エンジンへの指示、完了ゲートと直し、エンジンの選び方と権限、上限と止まる条件、報告、実行の記録と秘密情報、コンテナ、中断、動作環境、実行時依存を含む。

## Requirements

### Requirement: 仕様ゲートの確認
`loomake run --change <id>` は、最初にその change の仕様ゲート（`verify --spec-only` と同じ検査）を実行し、不合格なら実装を始めずに、不合格の内容を表示して終了コード 1 を返す SHALL。

Source: REQ-093

#### Scenario: 仕様ゲートに不合格
- **WHEN** 未回答のブロッキング確認事項がある change に `loomake run --change c1` を実行する
- **THEN** 確認事項の内容が表示され、ブランチは作られず、エンジンは呼ばれず、終了コードは 1 である

#### Scenario: 仕様ゲートに合格
- **WHEN** 仕様ゲートに合格する change に `loomake run --change c1` を実行する
- **THEN** 実装に進む

### Requirement: 未コミットの変更があるときは始めない
作業ツリーに未コミットの変更（git が追跡していない新しいファイルを含み、`.gitignore` で除外したファイルを含まない）があるとき、`loomake run` は実装を始めず、変更のあるファイルを表示して終了コード 1 を返す SHALL。

Source: REQ-094

#### Scenario: 変更したファイルがある
- **WHEN** コミット済みのファイルを書き換えた状態で `loomake run --change c1` を実行する
- **THEN** そのファイル名が表示され、エンジンは呼ばれず、終了コードは 1 である

#### Scenario: 追跡していないファイルがある
- **WHEN** git が追跡していない新しいファイルがある状態で `loomake run --change c1` を実行する
- **THEN** エンジンは呼ばれず、終了コードは 1 である

### Requirement: 予定だけを表示する
`--dry-run` を付けた場合、`loomake run` は仕様ゲートと未コミットの変更の確認を行ったうえで、エンジンに渡す予定のタスクの一覧と、最初のタスクの指示の全文を表示し、ブランチを作らず、エンジンを呼ばずに終了コード 0 を返す SHALL。

Source: REQ-095

#### Scenario: --dry-run
- **WHEN** 未完了のタスクが 2 つある change に `loomake run --change c1 --dry-run` を実行する
- **THEN** 2 つのタスクと、最初のタスクの指示の全文が表示され、ブランチは作られず、エンジンは呼ばれず、終了コードは 0 である

### Requirement: change のブランチ
`loomake run` は、`loomake/<change-id>` のブランチで実装する SHALL。ブランチがなければいまの HEAD から作り、あればそこに切り替えて続ける SHALL。ブランチがあるときは、未コミットの変更の確認のあと、エンジンに渡すタスクを読む前にそのブランチへ切り替え、仕様ゲートとタスクの読み取りをそのブランチの内容で行う SHALL。`--dry-run` のときは、表示のあとに元のブランチへ戻す SHALL。

Source: REQ-096

#### Scenario: ブランチがない
- **WHEN** `loomake/c1` のブランチがないリポジトリで `loomake run --change c1` を実行する
- **THEN** いまの HEAD から `loomake/c1` が作られ、そのブランチでコミットされる

#### Scenario: ブランチがある
- **WHEN** `loomake/c1` のブランチがすでにあるリポジトリで `loomake run --change c1` を実行する
- **THEN** `loomake/c1` に切り替えて、その続きにコミットされる

#### Scenario: 別のブランチから再開する
- **WHEN** `loomake/c1` では 1.1 が `- [x]`、main では 1.1 が `- [ ]` のとき、main で `loomake run --change c1` を実行する
- **THEN** エンジンに 1.1 は渡されず、1.2 から渡される

### Requirement: タスクを 1 つずつ渡す
`loomake run` は、tasks.md の未完了のタスクを上から順に、1 回に 1 つずつエンジンに渡す SHALL。

Source: REQ-097

#### Scenario: 上から順に 1 つずつ
- **WHEN** 未完了のタスク 1.1・1.2 がある change を実行する
- **THEN** エンジンは 2 回呼ばれ、1 回目の指示には 1.1 だけが、2 回目の指示には 1.2 だけが対象のタスクとして含まれる

#### Scenario: 完了済みのタスクは渡さない
- **WHEN** 1.1 が `- [x]`、1.2 が `- [ ]` の change を実行する
- **THEN** エンジンに渡されるのは 1.2 だけである

### Requirement: エンジンへの指示
エンジンへの指示は、AGENTS.md の全文、対象のタスク、change の差分仕様のすべての spec.md、trace.md を含む SHALL。あわせて、tasks.md・trace.md・`openspec/specs/` を書き換えないことと、仕様にない判断が要るときは `LOOMAKE-QUESTION:` で始まる行に質問を書いて何も変えずに終えることを、決まりとして含む SHALL。

Source: REQ-098

#### Scenario: 指示の中身
- **WHEN** `loomake run --change c1 --dry-run` で最初のタスクの指示を表示する
- **THEN** 指示に、AGENTS.md の全文・タスクの行・差分仕様・trace.md・2 つの決まりが含まれる

### Requirement: タスクごとのコミット
エンジンがタスクを終えるたびに、`loomake run` は tasks.md のそのタスクを `- [x]` にし、エンジンの変更と合わせて `run(<change-id>): <タスクの番号と本文>` のメッセージでコミットする SHALL。tasks.md のタスクを完了にするのは run であり、エンジンではない SHALL。エンジンが 0 以外の終了コードで終わったとき（終了コードが得られないときを含む）は、そのタスクを完了にせず、コミットもせずに、終了コードを理由として止まる SHALL。

Source: REQ-099

#### Scenario: タスクを終える
- **WHEN** エンジンが 1.1 のタスクでファイルを 1 つ足して終える
- **THEN** そのファイルと、1.1 を `- [x]` にした tasks.md が、`run(c1): 1.1 …` のメッセージで 1 つのコミットになる

#### Scenario: エンジンが失敗する
- **WHEN** エンジンが 1.1 のタスクで終了コード 1 で終わる
- **THEN** 1.1 は `- [ ]` のままで、コミットは増えず、run は終了コード 1 で止まる

### Requirement: 完了ゲートと直し
すべてのタスクを終えたら、`loomake run` は完了ゲート（`verify --done` と同じ検査）を実行する SHALL。不合格なら、不合格の内容をエンジンに渡して直させ、直しを `run(<change-id>): 完了ゲートの直し（N 回目）` でコミットしてから、もう一度完了ゲートを実行する SHALL。本文に `verify` と `--done` を含むタスクはエンジンに渡さず、完了ゲートに合格したときに run が完了にする SHALL。

Source: REQ-100

#### Scenario: 直して合格する
- **WHEN** 1 回目の完了ゲートに不合格になり、エンジンが直したあとの 2 回目で合格する
- **THEN** エンジンへの 2 回目の指示に 1 回目の不合格の内容が含まれ、直しが「完了ゲートの直し（1 回目）」でコミットされ、完了ゲートのタスクが `- [x]` になる

#### Scenario: 完了ゲートのタスクはエンジンに渡さない
- **WHEN** tasks.md の最後のタスクが「`pnpm -s verify --change c1 --done` を通す」の change を実行する
- **THEN** そのタスクはエンジンに渡されない

### Requirement: エンジンの選び方と権限
`loomake run` は `--engine` でエンジンを選び、省いたときは `claude-code` とする SHALL。知らないエンジンの名前と、`claude` コマンドが見つからないときは、使い方の誤りとして終了コード 2 を返す SHALL。Claude Code は headless（`claude -p`、出力は JSON）で呼び、指示は標準入力で渡す SHALL。ふだんは、ファイルの読み書きと、loomake.config.json の commands の実行だけを許可する操作の一覧として渡す SHALL。

Source: REQ-101

#### Scenario: 許可する操作の一覧を渡す
- **WHEN** commands に `pnpm test` を持つプロジェクトで、`--skip-permissions` を付けずに実行する
- **THEN** `claude` は `-p` と JSON の出力の指定で呼ばれ、許可する操作の一覧にファイルの読み書きと `pnpm test` が入り、権限確認を飛ばす指定は入らない

#### Scenario: 知らないエンジン
- **WHEN** `loomake run --change c1 --engine codex` を実行する
- **THEN** 初版で使えるのは claude-code だけだと表示され、終了コードは 2 である

#### Scenario: claude コマンドがない
- **WHEN** `claude` コマンドのない環境で `loomake run --change c1` を実行する
- **THEN** Claude Code を入れるよう表示され、終了コードは 2 である

### Requirement: 権限確認なしで動かす条件
`--skip-permissions` を付け、かつ環境変数 `LOOMAKE_SANDBOX` が `1` のときだけ、`loomake run` は Claude Code を権限確認なしで動かす SHALL。`--skip-permissions` を付けても `LOOMAKE_SANDBOX` が `1` でないときは、通信を許可したドメインに絞った環境で `LOOMAKE_SANDBOX=1` を設定するよう、既定の許可ドメイン（npm・GitHub・エンジンの API）とともに表示し、使い方の誤りとして終了コード 2 を返す MUST。

Source: REQ-121

#### Scenario: 絞った環境で権限確認を飛ばす
- **WHEN** `LOOMAKE_SANDBOX=1` の環境で `loomake run --change c1 --skip-permissions` を実行する
- **THEN** `claude` は権限確認を飛ばす指定つきで呼ばれる

#### Scenario: 環境を宣言していない
- **WHEN** `LOOMAKE_SANDBOX` を設定していない環境で `loomake run --change c1 --skip-permissions` を実行する
- **THEN** エンジンは呼ばれず、`LOOMAKE_SANDBOX=1` と既定の許可ドメインが表示され、終了コードは 2 である

### Requirement: 直しの回数の上限
完了ゲートの直しの回数が上限に達しても合格しないとき、`loomake run` は止まる SHALL。上限の既定は 5 回とし、loomake.config.json の `run.maxFixes` で変えられる SHALL。

Source: REQ-104

#### Scenario: 上限に達する
- **WHEN** `run.maxFixes` を 2 にして、完了ゲートにずっと不合格になる change を実行する
- **THEN** 直しを 2 回したあとに止まり、上限に達したことが報告され、終了コードは 1 である

### Requirement: 実行時間の上限
`loomake run` を始めてからの時間が上限に達したら、`loomake run` はエンジンのプロセスを止めて、止まる SHALL。上限の既定は 60 分とし、loomake.config.json の `run.timeoutMinutes` で変えられる SHALL。

Source: REQ-105

#### Scenario: 上限に達する
- **WHEN** 実行時間の上限を短くして、終わらないエンジンで実行する
- **THEN** エンジンのプロセスが止められ、時間の上限に達したことが報告され、終了コードは 1 である

### Requirement: エンジンの質問で止まる
エンジンの出力に `LOOMAKE-QUESTION:` で始まる行があれば、`loomake run` はそこで止まり、その質問を表示する SHALL。そのタスクは完了にせず、コミットもしない SHALL。

Source: REQ-106

#### Scenario: エンジンが質問する
- **WHEN** エンジンが `LOOMAKE-QUESTION: 上限は何件ですか` を出力して終える
- **THEN** 質問が表示され、そのタスクは未完了のまま、終了コードは 1 である

### Requirement: 止まったときの報告
止まったとき、`loomake run` は理由・終えたタスク・残ったタスク・最後の検査結果を、標準出力と実行の記録の `summary.json` に出す SHALL。PR まで進んだときの終了コードは 0、止まったときは 1 とする SHALL。

Source: REQ-107

#### Scenario: 止まった理由を報告する
- **WHEN** 2 つ目のタスクでエンジンが質問して止まる
- **THEN** 理由（エンジンの質問）・終えたタスク（1 つ目）・残ったタスク（2 つ目以降）・最後の検査結果が表示され、同じ内容が summary.json に書かれる

### Requirement: 実行の記録
`loomake run` は、実行ごとに `.loomake/runs/<UTC の日時>-<change-id>/` を作り、エンジンへの指示・エンジンの出力・各回の検査結果を、何回目かが分かる名前のファイルで保存する SHALL。`.loomake/runs/` には中身が `*` だけの `.gitignore` を置き、実行の記録を git の追跡と未コミットの変更の確認から外す SHALL。

Source: REQ-117

#### Scenario: 記録が残る
- **WHEN** タスクが 1 つの change を実行する
- **THEN** 実行の記録のディレクトリに、1 回目の指示・出力・検査結果のファイルと summary.json がある

#### Scenario: 記録は未コミットの変更にならない
- **WHEN** 実行の記録を書いたあとに `git status --porcelain` を実行する
- **THEN** `.loomake/runs/` の下のファイルは出てこない

### Requirement: 記録に秘密情報を含めない
実行の記録には環境変数を含めない MUST。指示と出力の中の、よく知られた API キーやトークンの形（`sk-` で始まるもの、`ghp_`・`github_pat_` で始まるもの、`AKIA` で始まるものなど）に合う文字列は、`***` に置き換えてから保存する MUST。

Source: REQ-118

#### Scenario: 出力にトークンが含まれる
- **WHEN** エンジンの出力に `ghp_` で始まるトークンが含まれる
- **THEN** 保存した出力では、そのトークンが `***` に置き換わっている

### Requirement: コンテナの中での実行
`loomake run` は、`/.dockerenv` か `/run/.containerenv` があるとき、または環境変数 `REMOTE_CONTAINERS`・`CODESPACES`・`DEVCONTAINER` のどれかが設定されているときに、コンテナの中とみなす SHALL。

Source: REQ-120

#### Scenario: devcontainer の中
- **WHEN** 環境変数 `REMOTE_CONTAINERS` が設定された環境で `loomake run --change c1` を実行する
- **THEN** コンテナの外の警告は出ない

### Requirement: コンテナの外での確認
コンテナの外で実行しようとしたとき、`loomake run` は警告して `続けますか [y/N]` と確認を求め、承諾されなければ止まる SHALL。確認を受け付けられない環境（標準入力が端末でない）では、止まって終了コード 1 を返す SHALL。

Source: REQ-122

#### Scenario: 端末で断る
- **WHEN** コンテナの外で `loomake run --change c1` を実行し、確認で拒否する
- **THEN** エンジンは呼ばれず、終了コードは 1 である

#### Scenario: 確認できない環境
- **WHEN** コンテナの外で、標準入力が端末でない状態で `loomake run --change c1` を実行する
- **THEN** 警告が表示され、エンジンは呼ばれず、終了コードは 1 である

### Requirement: 中断されたときの記録
中断（SIGINT など）されたとき、`loomake run` はその時点の記録と、中断した旨の summary.json を書いてから終わる SHALL。終えたタスクのコミットは残し、途中のタスクの変更はコミットせずに作業ツリーに残す SHALL。

Source: REQ-124

#### Scenario: 2 つ目のタスクの途中で中断する
- **WHEN** 1 つ目のタスクを終えたあと、2 つ目のタスクのエンジンの実行中に SIGINT を受ける
- **THEN** 1 つ目のタスクのコミットが残り、summary.json に中断したことが書かれ、2 つ目のタスクは未完了のまま残る

### Requirement: 動作環境
`loomake run` は、Node.js 20.19 以上で動作する SHALL。

Source: REQ-125

#### Scenario: Node.js 20.19 で動く
- **WHEN** Node.js 20.19 の環境で run のテストを実行する
- **THEN** テストが合格する

### Requirement: runner の実行時依存
`@loomake/runner` の実行時依存は `@loomake/core`・`@loomake/kit`・`@loomake/trace` のみとする SHALL。エンジンの CLI と gh CLI は、実行時に外部のコマンドとして呼ぶ SHALL。

Source: REQ-123

#### Scenario: runner の依存
- **WHEN** `packages/runner/package.json` の `dependencies` を読む
- **THEN** `@loomake/core`・`@loomake/kit`・`@loomake/trace` 以外が含まれない
