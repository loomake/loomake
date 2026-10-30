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
作業ツリーに未コミットの変更（git が追跡していない新しいファイルを含み、`.gitignore` で除外したファイルを含まない）があるとき、`loomake run` は実装を始めず、変更のあるファイルを表示して終了コード 1 を返す SHALL。loomake.config.json の `tests.report` のファイルが `.gitignore` で除外されていないときも、実装を始めず、`.gitignore` に足すよう表示して終了コード 1 を返す SHALL。

Source: REQ-094

#### Scenario: 変更したファイルがある
- **WHEN** コミット済みのファイルを書き換えた状態で `loomake run --change c1` を実行する
- **THEN** そのファイル名が表示され、エンジンは呼ばれず、終了コードは 1 である

#### Scenario: 追跡していないファイルがある
- **WHEN** git が追跡していない新しいファイルがある状態で `loomake run --change c1` を実行する
- **THEN** エンジンは呼ばれず、終了コードは 1 である

#### Scenario: テストのレポートを除外していない
- **WHEN** `.loomake/test-report.json` を `.gitignore` で除外していないプロジェクトで `loomake run --change c1` を実行する
- **THEN** `.gitignore` に足すよう表示され、エンジンは呼ばれず、終了コードは 1 である

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
エンジンへの指示は、AGENTS.md の全文、対象のタスク、change の差分仕様のすべての spec.md、trace.md を含む SHALL。あわせて、tasks.md・trace.md・`openspec/specs/` を書き換えないことと、仕様にない判断が要るときは `LOOMAKE-QUESTION:` で始まる行に質問を書いて何も変えずに終えることを、決まりとして含む SHALL。git でコミットしたりブランチを切り替えたりせず、変更は作業ツリーに残して終えること（コミットは loomake run が行うこと）も、決まりとして含む SHALL。

Source: REQ-098

#### Scenario: 指示の中身
- **WHEN** `loomake run --change c1 --dry-run` で最初のタスクの指示を表示する
- **THEN** 指示に、AGENTS.md の全文・タスクの行・差分仕様・trace.md・2 つの決まりが含まれる

#### Scenario: コミットしない決まり
- **WHEN** `loomake run --change c1 --dry-run` で最初のタスクの指示を表示する
- **THEN** 指示に、git でコミットしたりブランチを切り替えたりしないことと、コミットは loomake run が行うことが含まれる

### Requirement: タスクごとのコミット
エンジンがタスクを終え、変更を残したか、変更不要の合図と理由を出したとき、`loomake run` は tasks.md のそのタスクを `- [x]` にし、エンジンの変更と合わせて `run(<change-id>): <タスクの番号と本文>` のメッセージでコミットする SHALL。tasks.md のタスクを完了にするのは run であり、エンジンではない SHALL。エンジンが 0 以外の終了コードで終わったとき（終了コードが得られないときを含む）は、そのタスクを完了にせず、コミットもせずに、終了コードを理由として止まる SHALL。

変更も変更不要の合図と理由もなければ、REQ-330 に従い未完了のまま止まる SHALL。

Source: REQ-099

#### Scenario: タスクを終える
- **WHEN** エンジンが 1.1 のタスクでファイルを 1 つ足して終える
- **THEN** そのファイルと、1.1 を `- [x]` にした tasks.md が、`run(c1): 1.1 …` のメッセージで 1 つのコミットになる

#### Scenario: エンジンが失敗する
- **WHEN** エンジンが 1.1 のタスクで終了コード 1 で終わる
- **THEN** 1.1 は `- [ ]` のままで、コミットは増えず、run は終了コード 1 で止まる

### Requirement: 完了ゲートと直し
すべてのタスクを終えたら、`loomake run` は完了ゲート（`verify --done` と同じ検査）を実行する SHALL。不合格なら、不合格の内容をエンジンに渡して直させ、変更があるときは直しを `run(<change-id>): 完了ゲートの直し（N 回目）` でコミットしてから、もう一度完了ゲートを実行する SHALL。変更がなければ、REQ-331 に従い完了ゲートを実行し直さずに止まる SHALL。完了ゲートのタスクはエンジンに渡さず、完了ゲートに合格したときに run が完了にする SHALL。完了ゲートのタスクは、行に `<!-- loomake:gate=done -->` の印があるタスクとする SHALL。印のないタスクでも、本文に `verify` と `--done` を含むものは旧書式の完了ゲートのタスクとみなし、印を付けるよう案内を表示する SHALL。エンジンへの指示とコミットのメッセージには、印を除いたタスクの文を使う SHALL。

Source: REQ-100

#### Scenario: 直して合格する
- **WHEN** 1 回目の完了ゲートに不合格になり、エンジンが直したあとの 2 回目で合格する
- **THEN** エンジンへの 2 回目の指示に 1 回目の不合格の内容が含まれ、直しが「完了ゲートの直し（1 回目）」でコミットされ、完了ゲートのタスクが `- [x]` になる

#### Scenario: 完了ゲートのタスクはエンジンに渡さない
- **WHEN** tasks.md の最後のタスクが「`pnpm -s verify --change c1 --done` を通す」の change を実行する
- **THEN** そのタスクはエンジンに渡されない

#### Scenario: 印のあるタスク
- **WHEN** tasks.md の最後のタスクが「品質の確認を通す <!-- loomake:gate=done -->」の change を実行する
- **THEN** そのタスクはエンジンに渡されず、完了ゲートに合格したときに `- [x]` になる

#### Scenario: 旧書式のタスク
- **WHEN** 印がなく、本文が「`pnpm -s verify --change c1 --done` を通す」のタスクを持つ change を実行する
- **THEN** そのタスクはエンジンに渡されず、行に `<!-- loomake:gate=done -->` を付けるよう案内が表示される

#### Scenario: 印は指示とメッセージに含めない
- **WHEN** 印のある完了ゲートのタスクを持つ change で、完了ゲートに不合格のまま直しの回数の上限に達して止まる
- **THEN** 残ったタスクの表示と summary.json の完了ゲートのタスクに `<!-- loomake:gate=done -->` が含まれない

### Requirement: エンジンの選び方と権限
`loomake run` は `--engine` でエンジンを選び、省いたときは `claude-code` とする SHALL。知らないエンジンの名前と、`claude` コマンドが見つからないときと、change-id が OpenSpec の change 名の形でないときと、`archive` のときは、使い方の誤りとして終了コード 2 を返す SHALL。Claude Code は headless（`claude -p`、出力は JSON）で呼び、指示は標準入力で渡す SHALL。ふだんは、ファイルの読み書きと、loomake.config.json の commands の実行だけを許可する操作の一覧として渡す SHALL。

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

#### Scenario: パスの区切りを含む change-id
- **WHEN** `loomake run --change ../c1` を実行する
- **THEN** change-id にパスの区切りを含められないと表示され、終了コードは 2 である

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
`loomake run` を始めてからの時間が上限に達したら、`loomake run` はエンジンのプロセスか、完了ゲートの品質コマンドのプロセスを止めて、止まる SHALL。上限の既定は 60 分とし、loomake.config.json の `run.timeoutMinutes` で変えられる SHALL。

Source: REQ-105

#### Scenario: 上限に達する
- **WHEN** 実行時間の上限を短くして、終わらないエンジンで実行する
- **THEN** エンジンのプロセスが止められ、時間の上限に達したことが報告され、終了コードは 1 である

#### Scenario: 完了ゲートのあいだに上限に達する
- **WHEN** 実行時間の上限を短くして、終わらないテストのコマンドを持つプロジェクトで実行する
- **THEN** テストのプロセスが止められ、時間の上限に達したことが報告され、終了コードは 1 である

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
中断（SIGINT など）されたとき、`loomake run` はその時点の記録と、中断した旨の summary.json を書いてから終わる SHALL。終えたタスクのコミットは残し、途中のタスクの変更はコミットせずに作業ツリーに残す SHALL。完了ゲートの品質コマンドの実行中に中断されたときは、そのコマンドを子のプロセスまで止めて中断で止めたと記録し、残りの品質コマンドもエンジンも動かさずに終わる SHALL。

Source: REQ-124

#### Scenario: 2 つ目のタスクの途中で中断する
- **WHEN** 1 つ目のタスクを終えたあと、2 つ目のタスクのエンジンの実行中に SIGINT を受ける
- **THEN** 1 つ目のタスクのコミットが残り、summary.json に中断したことが書かれ、2 つ目のタスクは未完了のまま残る

#### Scenario: 完了ゲートの品質コマンドの途中で中断する
- **WHEN** 完了ゲートの test コマンドの実行中に、run のプロセスグループが SIGINT を受ける
- **THEN** test コマンドとその子のプロセスは止まり、test の検査は中断で止めたと記録され、エンジンは呼ばれず、summary.json に中断したことが書かれ、終了コードは 1 である

### Requirement: runner の実行時依存
`@loomake/runner` の実行時依存は `@loomake/core`・`@loomake/kit`・`@loomake/trace` のみとする SHALL。エンジンの CLI と gh CLI は、実行時に外部のコマンドとして呼ぶ SHALL。

Source: REQ-123

#### Scenario: runner の依存
- **WHEN** `packages/runner/package.json` の `dependencies` を読む
- **THEN** `@loomake/core`・`@loomake/kit`・`@loomake/trace` 以外が含まれない

### Requirement: 実行中の失敗
`loomake run` を始める前（実行の記録を作る前）の git の失敗は、使い方の誤りとして終了コード 2 を返す SHALL。実行の記録を作ったあとに git の操作か証拠の記録が失敗したときは、`git の操作に失敗しました` などの理由と、終えたタスク・残ったタスクを表示して `summary.json` に書き、終了コード 1 で止まる SHALL。

Source: REQ-137

#### Scenario: 実行中に git のコミットが失敗する
- **WHEN** 1 つ目のタスクを終えたあと、コミットが git のフックで失敗する
- **THEN** run は止まり、理由に git の操作に失敗したことが含まれ、残ったタスクに 1 つ目のタスクがあり、summary.json に同じ内容が書かれ、終了コードは 1 である

#### Scenario: 始める前の git の失敗
- **WHEN** git のリポジトリでないディレクトリで `loomake run --change c1` を実行する
- **THEN** 実行の記録は作られず、終了コードは 2 である

### Requirement: エンジンの子プロセスの停止
時間切れか中断でエンジンを止めるとき、その子プロセスも停止する SHALL。終了要求を無視するプロセスは、終了を待つ猶予を設けた後に強制終了する SHALL。開始前に中断済みの場合はエンジンを起動しない SHALL。

Source: REQ-139

#### Scenario: 子が出力先を保持する
- **WHEN** エンジンが標準出力を継承した子プロセスを起動し、時間切れになる
- **THEN** 親と子が停止し、終了待ちが子の自然終了まで続かない

#### Scenario: 終了要求を無視する
- **WHEN** POSIXのエンジンがSIGTERMを無視したまま時間切れになる
- **THEN** 猶予後に強制終了し、不合格として停止する

#### Scenario: 中断済み
- **WHEN** 起動前に中断の合図が出ている
- **THEN** エンジンを起動せず中断として返す

### Requirement: 証拠記録の再検証の時間制限
自動実装から証拠記録の完了ゲートを再実行するときも、実行時間の残りを上限とする SHALL。上限に達したときは品質コマンドと子プロセスを停止し、PRを作成せず終了コード1で止まる SHALL。

Source: REQ-140

#### Scenario: 二度目の検査が停止しない
- **WHEN** 最初の完了ゲートは合格し、証拠記録の検査中に時間の上限に達する
- **THEN** 品質コマンドを止め、PRを作成せず、時間切れを理由として記録する

### Requirement: run設定の形の検証
run設定はオブジェクトであることを検証する SHALL。maxFixesは正の安全な整数、timeoutMinutesは正の有限数を受け付ける SHALL。不正な設定は日本語で説明し、UsageErrorとして終了コード2で返す SHALL。

Source: REQ-141

#### Scenario: 不正な形
- **WHEN** runがnull・配列・文字列である
- **THEN** TypeErrorではなく日本語の設定エラーで終了する

#### Scenario: 不正な数値
- **WHEN** maxFixesが小数か安全な整数の範囲外、またはtimeoutMinutesが有限数でない
- **THEN** 設定エラーとして拒否する

#### Scenario: 既定値と正しい設定
- **WHEN** runを省略するか正しい設定を渡す
- **THEN** 既定値または指定した値で実行できる

### Requirement: エンジンの出力予算
エンジンのstdoutとstderrの合計に既定16MiBの上限を設ける SHALL。収集と転送は上限以内とし、UTF-8の途中で切れる文字は出力しない SHALL。上限を超えたときはエンジンと子プロセスを停止する SHALL。上限内の通常の出力と時間切れ・中断の扱いは維持する SHALL。

Source: REQ-151

#### Scenario: 標準出力が上限を超える
- **WHEN** エンジンが上限を超える標準出力を返す
- **THEN** 収集する出力は上限以内となり、エンジンと子を止める

#### Scenario: 標準エラーが上限を超える
- **WHEN** エンジンがstdoutとstderrを合わせて上限を超える出力を返す
- **THEN** 転送するstderrを含む合計は上限以内となり、エンジンを止める

#### Scenario: 複数バイト文字の途中
- **WHEN** 上限の境界に日本語の複数バイト文字がある
- **THEN** 途中で切れた文字を転送せず、上限以内の完全な文字だけを保持する

### Requirement: 出力予算の設定と停止結果
run.maxOutputBytesに正の安全な整数を設定できる SHALL。不正な値は日本語のUsageErrorとする SHALL。出力が上限を超えたときは、理由を出力とsummaryに残して終了コード1で止まり、対象タスクを完了にせず、コミットとPRを作らない SHALL。

Source: REQ-152

#### Scenario: 設定した上限で停止する
- **WHEN** run.maxOutputBytesに小さな上限を設定し、エンジンが超過する
- **THEN** 上限超過を理由に停止し、対象タスクは未完了で、コミットとPRが増えない

#### Scenario: 不正な設定
- **WHEN** run.maxOutputBytesが0・小数・安全な整数でない値である
- **THEN** エンジンを動かさず、日本語の設定エラーで終了コード2を返す

### Requirement: 作業ツリー単位の実行排他
同じGit作業ツリーのrunを同時に実行しない SHALL。実行中はdry-runを含む二重起動を、ブランチ・タスク・記録を変更せず、理由を表示して終了コード1で止める SHALL。通常終了・中断・例外では、自分が取得したロックを解放する SHALL。Gitリポジトリでない場合の終了コード2と、実行記録を作らない動作は維持する SHALL。

Source: REQ-158

#### Scenario: 実行中に二重起動する
- **WHEN** エンジンが動いている作業ツリーで別のrunを起動する
- **THEN** 後のrunは開始せず、先のブランチ・タスク・記録を変更しない

#### Scenario: 中断して再実行する
- **WHEN** 実行を中断し、もう一度runを起動する
- **THEN** ロックが解放され、既存の未コミット変更の確認など通常の開始条件で判定する

### Requirement: 終了済みプロセスのロック回復
同じホストで所有プロセスの終了を確認できるロックは、回復処理を直列化して回収する SHALL。所有者が不明・別ホスト・生存中の場合や、別の回復処理がある場合はロックを削除せず、確認と再実行の手順を日本語で示す SHALL。別の実行のロックを解放しない SHALL。

Source: REQ-159

#### Scenario: 終了済みの所有者
- **WHEN** 同じホストの終了済みプロセスのロックが残る
- **THEN** 排他的に回復して実行を開始できる

#### Scenario: 所有者を判断できない
- **WHEN** ロックが壊れているか、別ホストが所有する
- **THEN** ロックと作業状態を保ち、確認する場所と再実行の手順を示す

### Requirement: 実行記録の一意性
同じchangeを同じ時刻に再実行しても、以前の実行記録を上書きしない SHALL。初回の記録名は既存の形式を維持し、衝突時は別の名前を使う SHALL。

Source: REQ-160

#### Scenario: 同じ秒の再実行
- **WHEN** 同じchangeを同じ日時で2回実行する
- **THEN** 両方のsummaryと出力が別々に残る

### Requirement: 検証済み証拠の安全な再利用
再実行でも完了ゲートを省略しない SHALL。作業ツリーが未変更で、直前のコミットが親を1つ持ち、対象changeの証拠ファイル1つだけを追加し、その証拠の形式・対象SHA・change・合格結果・現在の文書のスナップショットが一致するときは、同じ証拠とコミットを再利用する SHALL。候補の証拠が不正な場合は削除や上書きをせず止まる SHALL。最新コミットが別の実装や文書を変更した場合は、通常の証拠記録を行う SHALL。

Source: REQ-164

#### Scenario: pushやPR作成の失敗後に再実行する
- **WHEN** 合格証拠のコミット後にpushまたはPR作成が失敗し、状態を変えず再実行する
- **THEN** 完了ゲートを通し、同じ証拠とコミットで外部操作を再試行する

#### Scenario: 不正な証拠が直前にある
- **WHEN** 候補の証拠のJSON・SHA・合格結果・文書の対応に誤りがある
- **THEN** 証拠と作業状態を保ち、理由を示して止まる

#### Scenario: 証拠の後で実装を変更した
- **WHEN** 証拠のコミットの後に実装変更をコミットして再実行する
- **THEN** 新しい実装に対する検証と新しい証拠記録を行う

### Requirement: 既存PRを確認した上での再試行
push後に同じリポジトリの同じbase/headのopen PRを検索する SHALL。一意に存在する場合は新規作成せず、既存のURLを表示して終了コード0で終える SHALL。存在しない場合だけ作成する SHALL。検索失敗・不正な結果・複数の候補では新規作成せず、理由を記録して終了コード1で止まる SHALL。PRのURLは認証情報を含まないHTTPSのpullリクエストURLとして検証する SHALL。

Source: REQ-165

#### Scenario: 作成の応答だけが失われた
- **WHEN** 前回の作成でPRが作られたが失敗として終了し、そのまま再実行する
- **THEN** 既存PRを見つけ、PRを重複作成せず完了する

#### Scenario: PR検索の結果を判断できない
- **WHEN** 検索が失敗するか、結果が壊れているか、一意に決まらない
- **THEN** 新規作成へ進まず、証拠を保って停止する

### Requirement: 再試行の検証と作業状態の保護
再試行時に検証が不合格なら外部操作へ進まない SHALL。証拠を再利用する場合も、今回の検証中のHEADの変更や検証後の未コミット変更を検出したら止まる SHALL。停止の理由と既存PRを使った結果を実行記録へ残す SHALL。復旧試験では、ローカルGitと代替ghによる結果を実際のGitHub接続の成功として報告しない SHALL。

Source: REQ-166

#### Scenario: 再試行で検証が不合格になる
- **WHEN** 証拠コミットが存在しても今回の完了ゲートに不合格となる
- **THEN** 以前の合格を代用せず、pushとPR操作を行わない

#### Scenario: 検証が作業状態を変更する
- **WHEN** 再試行の品質コマンドがHEADまたは作業ファイルを変更する
- **THEN** 以前の証拠を再利用して外部操作へ進まず、変更を残して停止する

### Requirement: 壊れた設定ファイル
`loomake run` は、`loomake.config.json` を JSON として読めないとき、エンジンを呼ばず、実行の記録も作らずに、読めない理由を日本語で表示して終了コード 2 を返す SHALL。

Source: REQ-193

#### Scenario: JSON が壊れている
- **WHEN** `loomake.config.json` の中身が `{bad` のプロジェクトで `loomake run --change c1` を実行する
- **THEN** 標準エラーに `loomake.config.json を読めません` が含まれ、スタックトレースは出ず、実行の記録は作られず、終了コードは 2 である

### Requirement: Node.js の下限
`loomake run` は、Node.js 22.12 以上で動作する SHALL。

Source: REQ-142

#### Scenario: Node.js 22.12 で動く
- **WHEN** Node.js 22.12 の環境で run のテストを実行する
- **THEN** テストが合格する

### Requirement: エンジンの診断ストリームの保護
エンジンのstderrに含まれる、既存の保存ログで置換する既知のトークン形式を、転送前に置換する SHALL。チャンクの分割位置に依存せず、終了時の末尾も処理する SHALL。未確定なASCII単語の保持は4096文字までとし、これを超える単語は省略して保持を増やさない SHALL。通常の短い診断は維持する SHALL。

Source: REQ-153

#### Scenario: チャンクの境界にあるトークン
- **WHEN** 既知のトークンを複数のチャンクに分けてstderrへ出す
- **THEN** 転送先にトークン全体を出さず、置換して転送する

#### Scenario: 改行のない末尾
- **WHEN** 既知のトークンを改行なしで出して終了する
- **THEN** 末尾も置換してから転送する

#### Scenario: 区切りのない長い単語
- **WHEN** 4096文字を超えるASCII単語を出し続ける
- **THEN** 保持量を増やし続けず、その単語を省略し、次の通常の診断を転送できる

### Requirement: runnerの表示境界の保護
runnerが表示する質問・停止理由・差分・進捗に含まれる、既存の保存ログで置換する既知のトークン形式を、表示前に置換する SHALL。保存するsummaryの保護と、通常の表示は維持する SHALL。

Source: REQ-154

#### Scenario: 質問にトークンが含まれる
- **WHEN** エンジンの質問に既知のトークン形式が含まれる
- **THEN** 質問と停止理由の表示とsummaryではトークンを置換する

#### Scenario: 進捗にトークンが含まれる
- **WHEN** 品質コマンドの進捗に既知のトークン形式が含まれる
- **THEN** 転送先へ置換した進捗を出す

### Requirement: 置換する秘密情報の形
REQ-118 の置換は、`sk-`・`ghp_` などの形に加えて、次の形の文字列も `***` に置き換える MUST。npm のトークン（`npm_` に 36 文字）、Slack のトークン（`xoxb-` などで始まるもの）、GitLab のトークン（`glpat-` で始まるもの）、Google の API キー（`AIza` に 35 文字）、JWT（`eyJ` で始まる 3 つの部分を `.` でつないだもの）、秘密鍵のブロック（`-----BEGIN … PRIVATE KEY-----` から `-----END … PRIVATE KEY-----` まで）、`Bearer` に続くトークン。`Bearer` は残し、続くトークンだけを置き換える MUST。

Source: REQ-199

#### Scenario: 新しい形のトークン
- **WHEN** エンジンの出力に npm・Slack・GitLab・Google のトークンと JWT が含まれる
- **THEN** 保存した出力では、それぞれが `***` に置き換わっている

#### Scenario: 秘密鍵のブロック
- **WHEN** エンジンの出力に複数行の秘密鍵のブロックが含まれる
- **THEN** 保存した出力では、BEGIN から END までが `***` に置き換わっている

#### Scenario: Bearer トークン
- **WHEN** エンジンの出力に `Authorization: Bearer` に続くトークンが含まれる
- **THEN** 保存した出力では `Authorization: Bearer ***` になっている

### Requirement: 出力と記録の既定の上限の整合
既定の設定では、エンジンの出力の上限に、エンジンを呼ぶ最大の回数のうち完了ゲートの分（1 回と直しの上限の回数）を掛けた量が、1 回の実行の記録の上限から停止情報の予約を引いた量に収まる SHALL。

Source: REQ-210

#### Scenario: 既定の設定
- **WHEN** `run` の設定を省いて、既定値を読む
- **THEN** 出力の上限 ×（1 + 直しの上限）が、記録の上限 − 停止情報の予約 以下である

### Requirement: 終了の信号での中断
`loomake run` は、SIGTERM と SIGHUP を受けたときも、SIGINT と同じく中断として扱う SHALL。エンジンとその子のプロセスを止め、REQ-124 と同じ記録（中断した旨の summary.json、終えたタスクのコミット、途中の変更の作業ツリー）を残してから、終了コード 1 で終わる SHALL。loomake が終わったあとに、エンジンのプロセスを残さない SHALL。品質コマンドや git のような同期の処理のあいだに届いた中断は、その処理が終わったところで扱い、証拠の記録・push・PR の作成に進まない SHALL。

Source: REQ-208

#### Scenario: SIGTERM で中断する
- **WHEN** 1 つ目のタスクを終えたあと、2 つ目のタスクのエンジンの実行中に、配布物の CLI が SIGTERM を受ける
- **THEN** 終了コードは 1 で、summary.json の状態は interrupted、終えたタスクは 1.1 だけで、エンジンのプロセスは残っていない

#### Scenario: SIGHUP で中断する
- **WHEN** 同じ状況で、配布物の CLI が SIGHUP を受ける
- **THEN** SIGTERM のときと同じく中断として記録し、エンジンのプロセスは残っていない

#### Scenario: 品質コマンドのあいだに中断する
- **WHEN** 完了ゲートの品質コマンドの実行中に、CLI が SIGTERM を受ける
- **THEN** 品質コマンドが終わったところで中断として止まり、終了コードは 1 で、push も PR の作成もしない

#### Scenario: 既存の PR の検索のあいだに中断する
- **WHEN** 既存の PR の検索の実行中に、CLI が SIGTERM を受ける
- **THEN** 検索が終わったところで中断として止まり、PR を作らない

### Requirement: 通常終了したエンジンの子の後処理
POSIXでは、エンジンのプロセスが終了したあとにも同じプロセスグループに残る子を停止し、後処理を待ってからエンジンの呼び出しを完了する SHALL。終了要求を無視する子は猶予後に強制終了する SHALL。後処理だけを理由に、エンジン自身の終了コード、出力、時間切れ・中断・出力上限の判定を変えない SHALL。この追加保証は同じPOSIXプロセスグループに限り、別のセッションに離脱した子とWindowsでの通常終了後の子の停止は含まない SHALL。既存の明示停止時の処理は維持する SHALL。

Source: REQ-212

#### Scenario: 正常終了したあとに子が残る
- **WHEN** POSIXのエンジンが標準入出力を共有しない同じプロセスグループの子を起動し、その子の起動を確認してから終了コード0で終える
- **THEN** 呼び出しが戻った時点でその子は動作しておらず、その子が予定していた後からのファイル作成は起こらない

#### Scenario: 正常終了した親の子が終了要求を無視する
- **WHEN** POSIXのエンジンが、終了要求を無視してファイルの作成を予定する同じプロセスグループの子の起動を確認してから終了コード0で終える
- **THEN** 猶予後にその子を強制終了し、後処理を待ってから戻り、予定していたファイルは作られない

#### Scenario: 通常の結果を保つ
- **WHEN** POSIXのエンジンが上限内のJSON出力を返し、時間切れも中断も起きずに終了コード0で終える
- **THEN** 後処理のあとも終了コード0と出力の本文・元の出力を保ち、時間切れ・中断・出力上限超過として扱わない

#### Scenario: 非ゼロの終了コードを保つ
- **WHEN** POSIXのエンジンが上限内の出力を返し、時間切れも中断も起きずに終了コード1で終える
- **THEN** 後処理のあとも終了コード1と出力を保ち、時間切れや中断として扱わない

#### Scenario: 強制終了したあとはグループの終了を待ってから戻る
- **WHEN** POSIXのエンジンの停止でSIGKILLを送ったあと、同じプロセスグループに終了処理を終えていないメンバーが残っている
- **THEN** 自分の子はexitで回収し、孫はゾンビと消滅を「動作していない」とみなして、メンバーが動作していなくなるまで待ってから戻る。この待機は1000msを上限とし、上限を超えたらそれ以上待たずに戻る

### Requirement: エンジンの時間の上限とタイマーの上限
`loomake run` は、エンジンに渡す時間の上限が Node のタイマーの上限（2147483647ms）を超えても、上限を短くせずにエンジンを監視する SHALL。待機はタイマーの上限以下に分け、発火するたびに単調時計で残り時間を計り直す SHALL。残り時間があれば待ち直し、尽きたときだけ時間切れとしてエンジンとその子のプロセスを止める SHALL。時間内に終えたエンジンの終了コードと出力を、時間切れとして扱わない SHALL。実行時間の上限の既定（60 分）と、`run.timeoutMinutes` に受け付ける値（正の有限数）は変えない SHALL。

Source: REQ-336

#### Scenario: タイマーの上限を超える run.timeoutMinutes
- **WHEN** `run.timeoutMinutes` を 40000 にして、0.5 秒で終わるエンジンで実行する
- **THEN** エンジンは時間切れにならず、タスクのコミットが残り、時間の上限に達したことは報告されず、終了コードは 0 である

#### Scenario: 分けた待機が期限より前に発火する
- **WHEN** タイマーの上限を超える時間の上限でエンジンを呼び、分けた待機が期限より前に発火する
- **THEN** 残り時間を計り直して待ち直し、どの待機もタイマーの上限以下で、時間内に終えたエンジンの結果を保つ

### Requirement: 外部操作のあいだの中断の記録
実行の記録を作ったあと、git や gh の実行中に監視役が SIGINT か SIGTERM を受けて操作を止めたとき（理由を持たない中断）、`loomake run` は中断として止まる SHALL。summary.json の状態を interrupted にし、理由・終えたタスク・残ったタスクを書いて、終了コード 1 で終わる SHALL。後続のタスク・エンジン・証拠の記録・push・PR の作成には進まない SHALL。証拠のコミットのあとの push・PR の検索・PR の作成で中断したときも、証拠のコミットを保ち、状態を interrupted とする SHALL。監視役が結果を書かずに終わったときのように理由を持つ中断は、利用者の中断と区別して、状態を stopped とする SHALL。先の外部操作の監視役が結果を書かずに終わったために、同じ共有予算の後続の git や gh を起動しなかったときも、その理由を持つ中断として、状態を stopped とし、理由に監視役が結果を書かずに終わったことを含める SHALL。

Source: REQ-337

#### Scenario: タスクのコミットのあいだに中断する
- **WHEN** 1 つ目のタスクのコミットの git の実行中に、監視役が SIGINT か SIGTERM を受ける
- **THEN** summary.json の状態は interrupted で、終えたタスクはなく、残ったタスクに 1 つ目のタスクがあり、エンジンは再び呼ばれず、終了コードは 1 である

#### Scenario: 証拠の push のあいだに中断する
- **WHEN** 証拠をコミットしたあと、push の git の実行中に、監視役が SIGINT を受ける
- **THEN** 証拠のコミットが残り、summary.json の状態は interrupted で、PR は作られず、終了コードは 1 である

#### Scenario: 監視役が結果を書かずに終わる
- **WHEN** タスクのコミットの git の実行中に、監視役が強制終了される
- **THEN** summary.json の状態は stopped で、理由に監視役が結果を書かずに終わったことが含まれる

#### Scenario: PR の検索か作成のあいだに中断する
- **WHEN** push のあと、gh の PR の検索か作成の実行中に、監視役が SIGINT か SIGTERM を受ける
- **THEN** 証拠のコミットと push したブランチが残り、summary.json の状態は interrupted で、PR は作られず、終了コードは 1 である

#### Scenario: 品質コマンドの監視役が結果を書かずに終わったあとの git
- **WHEN** 完了ゲートの品質コマンドの実行中に、その監視役が強制終了される
- **THEN** 後続の git は起動されず、summary.json の状態は stopped で、理由に監視役が結果を書かずに終わったことが含まれ、エンジンは直しに呼ばれず、push も PR の作成もされず、終了コードは 1 である

### Requirement: 変更を残さずに終えたタスク
エンジンがタスクで終了コード 0 のまま終え、質問・HEADやブランチの変更・Git内部の変更・不正な直し方のどれもないとき、`loomake run` は、run がそのタスクを完了にする前の時点で、エンジンの変更が index にあるかを調べる SHALL。調べる対象は、不正な直し方の検出と同じ `git add -A` 後の index とし、`.gitignore` で除外したファイルは含めない SHALL。変更がなく、エンジンの出力に `LOOMAKE-NOCHANGE:` で始まり空でない理由を持つ行もなければ、そのタスクを完了にせず、コミットもせずに、状態 `stopped` と終了コード 1 で止まる SHALL。止まるときは、エンジンが変更を残さずに終わったことと、エンジンの出力の記録の場所と、権限や環境を見直して実行し直すか、変更が要らないなら人が tasks.md のそのタスクを完了にしてコミットしてから実行し直すことを表示する SHALL。

Source: REQ-330

#### Scenario: 何も変えずに終える
- **WHEN** エンジンが 1.1 のタスクで何も変えず、`LOOMAKE-NOCHANGE:` の行も出さずに終了コード 0 で終える
- **THEN** 1.1 は `- [ ]` のままで、コミットは増えず、エンジンはそれ以上呼ばれず、エンジンが変更を残さずに終わったことと対処が表示され、summary.json の status は `stopped`、終了コードは 1 である

#### Scenario: 行頭にない合図と理由のない合図
- **WHEN** エンジンが何も変えず、`引用 LOOMAKE-NOCHANGE: 例` か、理由のない `LOOMAKE-NOCHANGE:` だけを出力して終える
- **THEN** 合図とはみなさず、何も変えずに終えたときと同じに止まる

### Requirement: 変更が要らないタスクの合図
エンジンがタスクで変更を残さず、出力に `LOOMAKE-NOCHANGE:` で始まり空でない理由を持つ行があれば、`loomake run` は最初の行の理由を `maskSecrets` で置換したうえで標準出力と run のコミット本文に残し、tasks.md だけのコミットでそのタスクを完了にする SHALL。変更があれば、その行の有無にかかわらず、これまでどおりタスクを完了にしてコミットする SHALL。`LOOMAKE-QUESTION:` の行もあれば、質問で止まる SHALL。タスクの指示には、変更が要らないときは何も変えずに `LOOMAKE-NOCHANGE:` で始まる行に理由を書いて終えることと、変更もこの行もなければ run が止まることを、決まりとして含める SHALL。

Source: REQ-330

#### Scenario: 変更が要らないと合図する
- **WHEN** エンジンが 1.2 のタスクで何も変えず、`LOOMAKE-NOCHANGE: 1.1 で済んでいます` を出力して終える
- **THEN** その理由が `maskSecrets` で置換されて標準出力とコミット本文に残り、tasks.md だけを含む `run(c1): 1.2 …` のコミットで 1.2 が `- [x]` になる

#### Scenario: 変更と合図が両方ある
- **WHEN** エンジンがファイルを足し、`LOOMAKE-NOCHANGE:` の行も出力して終える
- **THEN** そのファイルと tasks.md が `run(c1): …` で 1 つのコミットになる

#### Scenario: 質問と合図が両方ある
- **WHEN** エンジンが何も変えず、`LOOMAKE-QUESTION:` と `LOOMAKE-NOCHANGE:` の行を出力して終える
- **THEN** 質問が表示され、タスクは未完了のまま、終了コードは 1 である

#### Scenario: 指示に合図の決まりを含める
- **WHEN** `loomake run --change c1 --dry-run` で最初のタスクの指示を表示する
- **THEN** 指示に `LOOMAKE-NOCHANGE:` の決まりが含まれる

### Requirement: 変更不要の理由の表示と記録
変更不要の理由は `maskSecrets` による置換後、C0/C1 制御文字（U+0000〜U+001F、U+007F〜U+009F）を、それぞれ `\u` と小文字16進4桁の文字列（例：`\u0000`）に変え、標準出力とコミット本文で同じ文字列を使う SHALL。ほかの文字は変えない SHALL。エンジンの出力の記録（`NN-output.json`）は、これまでどおり秘密情報の置換だけを行い、制御文字の原文を保つ SHALL。

Source: REQ-339

#### Scenario: 理由の制御文字を見える形にする
- **WHEN** エンジンが 1.2 のタスクで何も変えず、`LOOMAKE-NOCHANGE: 確認` に続けて U+001B・U+0009・U+007F・U+0085・U+009F・U+00A0 と「済み」を含む行を出力して終える
- **THEN** 標準出力とコミット本文の理由では、制御文字が `\u001b`・`\u0009`・`\u007f`・`\u0085`・`\u009f` になり、U+00A0 とほかの文字は変わらず、出力の記録には制御文字が元のまま残る

#### Scenario: 理由に NUL がある
- **WHEN** エンジンが 1.2 のタスクで何も変えず、`LOOMAKE-NOCHANGE: 確認` U+0000 `済み` を出力して終える
- **THEN** tasks.md だけを含む `run(c1): 1.2 …` のコミットで 1.2 が `- [x]` になり、コミット本文の理由は `確認\u0000済み` である

#### Scenario: 理由の末尾の空白を保つ
- **WHEN** エンジンが 1.2 のタスクで何も変えず、`LOOMAKE-NOCHANGE: 確認済み` に続けて U+0020 を 3 個置いた行を出力して終える
- **THEN** 標準出力とコミット本文の理由は、どちらも末尾の U+0020 3 個を含む同じ文字列である

### Requirement: 変更を残さない完了ゲートの直し
完了ゲートの直しで、エンジンが終了コード 0 のまま終え、質問・HEADやブランチの変更・Git内部の変更・不正な直し方のどれもなく、index に変更もないとき、`loomake run` は完了ゲートを実行し直さずに、状態 `stopped` と終了コード 1 で止まる SHALL。エンジンの出力に `LOOMAKE-NOCHANGE:` の行があっても止まる SHALL。止まるときは、直しでエンジンが変更を残さずに終わったことを理由とし、完了ゲートのタスクは完了にしない SHALL。直しの指示には `LOOMAKE-NOCHANGE:` の決まりを含めない SHALL。

止まるときの理由には、その直しで呼んだエンジンの出力の記録（`NN-output.json`）の具体的なパスを、タスクの段階で止まるときと同じ形で含める SHALL。

Source: REQ-331

#### Scenario: 直しで何も変えない
- **WHEN** `run.maxFixes` が既定の 5 で、1 回目の完了ゲートに不合格になり、直しのエンジンが何も変えずに終える
- **THEN** エンジンは直しで 1 回だけ呼ばれ、直しでエンジンが変更を残さずに終わったことが報告され、完了ゲートのタスクは `- [ ]` のまま、終了コードは 1 である

#### Scenario: 直しで変更が要らないと合図する
- **WHEN** 直しのエンジンが何も変えず、`LOOMAKE-NOCHANGE: 直すところがありません` を出力して終える
- **THEN** 完了ゲートを実行し直さずに止まり、終了コードは 1 である

#### Scenario: 直しの指示
- **WHEN** 完了ゲートに不合格になり、直しの指示をエンジンに渡す
- **THEN** 直しの指示に `LOOMAKE-NOCHANGE:` の決まりは含まれない

#### Scenario: 直しで止まるときの記録の場所
- **WHEN** 1 回目の完了ゲートに不合格になり、3 回目のエンジンの呼び出しに当たる直しが何も変えずに終える
- **THEN** 表示と summary.json の reason に、その実行の記録の `03-output.json` のパスが含まれ、そのファイルがある
