## ADDED Requirements

### Requirement: 証拠の記録
`loomake trace record --change <id>` は、その change に `verify --done` を実行し、結果を検査したコミットの SHA・コミットの日時・記録した日時と合わせて、`.loomake/evidence/<change-id>/` に JSON のファイルとして保存する SHALL。verify が不合格でも記録し、終了コードは verify と同じにする SHALL。記録したあとは、記録のファイルを git にコミットするよう日本語で案内する SHALL。

Source: REQ-066

#### Scenario: 合格した結果を記録する
- **WHEN** 完了ゲートに合格する change に、未コミットの変更のない作業ツリーで `loomake trace record --change c1` を実行する
- **THEN** `.loomake/evidence/c1/` に JSON のファイルが 1 つ作られ、verify の結果・HEAD のコミットの SHA・コミットの日時・記録した日時が入り、終了コードは 0 である

#### Scenario: コミットを案内する
- **WHEN** `loomake trace record --change c1` で記録が保存される
- **THEN** 保存したファイルのパスと、そのファイルを git にコミットするよう促す案内が表示される

#### Scenario: 不合格の結果も記録する
- **WHEN** 完了ゲートに不合格になる change に `loomake trace record --change c1` を実行する
- **THEN** 不合格の結果が記録され、終了コードは 1 である

#### Scenario: 存在しない change
- **WHEN** 存在しない change-id を `--change` に渡す
- **THEN** 何も記録されず、日本語のエラーメッセージが表示され、終了コードは 2 である

### Requirement: 未コミットの変更があるときは記録しない
作業ツリーに未コミットの変更（git が追跡していない新しいファイルを含み、`.gitignore` で除外したファイルを含まない）があるとき、`loomake trace record` は verify を実行せず、何も記録せずに、理由と変更のあるファイルを日本語で表示する SHALL。

Source: REQ-067

#### Scenario: 変更したファイルがある
- **WHEN** コミット済みのファイルを書き換えた状態で `loomake trace record --change c1` を実行する
- **THEN** 何も記録されず、未コミットの変更があることと、そのファイル名が表示され、終了コードは 1 である

#### Scenario: 追跡していないファイルがある
- **WHEN** git が追跡していない新しいファイルがある状態で `loomake trace record --change c1` を実行する
- **THEN** 何も記録されず、終了コードは 1 である

#### Scenario: 除外したファイルだけがある
- **WHEN** `.gitignore` で除外したファイルだけが変わっている状態で `loomake trace record --change c1` を実行する
- **THEN** 記録される

### Requirement: 記録を書き換えない
`loomake trace record` は、既存の記録のファイルを書き換えず、記録のたびに `<UTC の日時>-<SHA の先頭 12 文字>.json` という名前の新しいファイルを足す SHALL。同じ名前のファイルがあるときは、記録せずに終了コード 1 を返す MUST。

Source: REQ-068

#### Scenario: 2 回記録する
- **WHEN** 同じ change に、時刻を変えて `loomake trace record` を 2 回実行する
- **THEN** `.loomake/evidence/c1/` にファイルが 2 つあり、1 回目のファイルの中身は変わっていない

#### Scenario: 同じ名前のファイルがある
- **WHEN** これから作る記録と同じ名前のファイルがすでにある状態で `loomake trace record` を実行する
- **THEN** 既存のファイルは変わらず、終了コードは 1 である

### Requirement: オフラインでの動作
`loomake trace record` は、ネットワークに接続せずに動く SHALL。

Source: REQ-084

#### Scenario: ネットワークがない
- **WHEN** ネットワークに接続できない状態で `loomake trace record --change c1` を実行する
- **THEN** 記録が保存される

### Requirement: 動作環境
`loomake trace record` は、Node.js 20.19 以上で動作する SHALL。

Source: REQ-089

#### Scenario: Node.js 20.19 で動く
- **WHEN** Node.js 20.19 の環境で trace record のテストを実行する
- **THEN** テストが合格する

### Requirement: trace の実行時依存
`@loomake/trace` の実行時依存は `@loomake/core` と `@loomake/kit` のみとする SHALL。

Source: REQ-083

#### Scenario: trace の依存
- **WHEN** `packages/trace/package.json` の `dependencies` を読む
- **THEN** `@loomake/core` と `@loomake/kit` 以外が含まれない
