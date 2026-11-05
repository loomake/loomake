## MODIFIED Requirements

### Requirement: 証拠の記録
`loomake trace record --change <id>` は、その change に `verify --done` を実行し、結果を検査したコミットの SHA・コミットの日時・記録した日時と合わせて、`.loomake/evidence/<change-id>/` に JSON のファイルとして保存する SHALL。verify が不合格でも記録し、終了コードは verify と同じにする SHALL。記録したあとは、記録のファイルを git にコミットするよう日本語で案内する SHALL。change-id が OpenSpec の change 名の形でないときと、`archive` のときは、何も記録せず、使い方の誤りとして終了コード 2 を返す SHALL。 `--effort` を指定したときは verify を実行せず、REQ-466 の人の実績の記録だけを行う SHALL。

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

#### Scenario: パスの区切りを含む change-id
- **WHEN** `loomake trace record --change ../../packages` を実行する
- **THEN** 何も記録されず、change-id にパスの区切りを含められないと日本語で表示され、終了コードは 2 である

### Requirement: 検証した時点の文書の保存
`--effort` を指定しない `loomake trace record` は、verify を実行する前に、その change の trace.md と差分仕様（`specs/` の下の `spec.md`）を読み、それぞれの change のディレクトリからのパス・内容・SHA-256 のハッシュを、証拠の記録の `documents` に保存する SHALL。

Source: REQ-127

#### Scenario: 文書を保存する
- **WHEN** trace.md と `specs/x/spec.md` を持つ change に `loomake trace record --change c1` を実行する
- **THEN** 記録の `documents` に、`trace.md` と `specs/x/spec.md` のパス・そのときの内容・内容の SHA-256 が入る

### Requirement: 検査のあいだの変更
`--effort` を指定しない `loomake trace record` は、verify を実行する前と後で、HEAD のコミット、作業ツリーの未コミットの変更（`.gitignore` で除外したファイルを含まない）、保存する文書のハッシュを比べる SHALL。どれかが変わっていれば、記録せずに、変わったことを日本語で表示し、終了コード 1 を返す SHALL。

Source: REQ-128

#### Scenario: 検査のあいだにファイルが変わる
- **WHEN** 品質コマンドが、追跡しているファイルを書き換える change に `loomake trace record --change c1` を実行する
- **THEN** 何も記録されず、検査のあいだに作業ツリーが変わったことが表示され、終了コードは 1 である

#### Scenario: 除外したファイルだけが変わる
- **WHEN** 品質コマンドが、`.gitignore` で除外したテストのレポートだけを書き出す change に `loomake trace record --change c1` を実行する
- **THEN** 記録される
