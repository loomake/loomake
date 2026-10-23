## ADDED Requirements

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
`loomake run` は、`loomake/<change-id>` のブランチで実装する SHALL。ブランチがなければいまの HEAD から作り、あればそこに切り替えて続ける SHALL。

Source: REQ-096

#### Scenario: ブランチがない
- **WHEN** `loomake/c1` のブランチがないリポジトリで `loomake run --change c1` を実行する
- **THEN** いまの HEAD から `loomake/c1` が作られ、そのブランチでコミットされる

#### Scenario: ブランチがある
- **WHEN** `loomake/c1` のブランチがすでにあるリポジトリで `loomake run --change c1` を実行する
- **THEN** `loomake/c1` に切り替えて、その続きにコミットされる

### Requirement: エンジンへの指示
エンジンへの指示は、AGENTS.md の全文、対象のタスク、change の差分仕様のすべての spec.md、trace.md を含む SHALL。あわせて、tasks.md・trace.md・`openspec/specs/` を書き換えないことと、仕様にない判断が要るときは `LOOMAKE-QUESTION:` で始まる行に質問を書いて何も変えずに終えることを、決まりとして含む SHALL。

Source: REQ-098

#### Scenario: 指示の中身
- **WHEN** `loomake run --change c1 --dry-run` で最初のタスクの指示を表示する
- **THEN** 指示に、AGENTS.md の全文・タスクの行・差分仕様・trace.md・2 つの決まりが含まれる

### Requirement: タスクごとのコミット
エンジンがタスクを終えるたびに、`loomake run` は tasks.md のそのタスクを `- [x]` にし、エンジンの変更と合わせて `run(<change-id>): <タスクの番号と本文>` のメッセージでコミットする SHALL。tasks.md のタスクを完了にするのは run であり、エンジンではない SHALL。

Source: REQ-099

#### Scenario: タスクを終える
- **WHEN** エンジンが 1.1 のタスクでファイルを 1 つ足して終える
- **THEN** そのファイルと、1.1 を `- [x]` にした tasks.md が、`run(c1): 1.1 …` のメッセージで 1 つのコミットになる

### Requirement: 完了ゲートと直し
すべてのタスクを終えたら、`loomake run` は完了ゲート（`verify --done` と同じ検査）を実行する SHALL。不合格なら、不合格の内容をエンジンに渡して直させ、直しを `run(<change-id>): 完了ゲートの直し（N 回目）` でコミットしてから、もう一度完了ゲートを実行する SHALL。本文に `verify` と `--done` を含むタスクはエンジンに渡さず、完了ゲートに合格したときに run が完了にする SHALL。

Source: REQ-100

#### Scenario: 直して合格する
- **WHEN** 1 回目の完了ゲートに不合格になり、エンジンが直したあとの 2 回目で合格する
- **THEN** エンジンへの 2 回目の指示に 1 回目の不合格の内容が含まれ、直しが「完了ゲートの直し（1 回目）」でコミットされ、完了ゲートのタスクが `- [x]` になる

#### Scenario: 完了ゲートのタスクはエンジンに渡さない
- **WHEN** tasks.md の最後のタスクが「`pnpm -s verify --change c1 --done` を通す」の change を実行する
- **THEN** そのタスクはエンジンに渡されない

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
`loomake run` は、実行ごとに `.loomake/runs/<UTC の日時>-<change-id>/` を作り、エンジンへの指示・エンジンの出力・各回の検査結果を、何回目かが分かる名前のファイルで保存する SHALL。

Source: REQ-117

#### Scenario: 記録が残る
- **WHEN** タスクが 1 つの change を実行する
- **THEN** 実行の記録のディレクトリに、1 回目の指示・出力・検査結果のファイルと summary.json がある

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
