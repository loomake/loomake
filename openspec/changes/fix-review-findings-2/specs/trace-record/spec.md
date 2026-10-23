## MODIFIED Requirements

### Requirement: 証拠の記録
`loomake trace record --change <id>` は、その change に `verify --done` を実行し、結果を検査したコミットの SHA・コミットの日時・記録した日時と合わせて、`.loomake/evidence/<change-id>/` に JSON のファイルとして保存する SHALL。verify が不合格でも記録し、終了コードは verify と同じにする SHALL。記録したあとは、記録のファイルを git にコミットするよう日本語で案内する SHALL。change-id に `/`・`\`・`..` を含むときは、何も記録せず、使い方の誤りとして終了コード 2 を返す SHALL。

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
