## ADDED Requirements

### Requirement: 検証した時点の文書の保存
`loomake trace record` は、verify を実行する前に、その change の trace.md と差分仕様（`specs/` の下の `spec.md`）を読み、それぞれの change のディレクトリからのパス・内容・SHA-256 のハッシュを、証拠の記録の `documents` に保存する SHALL。

Source: REQ-127

#### Scenario: 文書を保存する
- **WHEN** trace.md と `specs/x/spec.md` を持つ change に `loomake trace record --change c1` を実行する
- **THEN** 記録の `documents` に、`trace.md` と `specs/x/spec.md` のパス・そのときの内容・内容の SHA-256 が入る

### Requirement: 検査のあいだの変更
`loomake trace record` は、verify を実行する前と後で、HEAD のコミット、作業ツリーの未コミットの変更（`.gitignore` で除外したファイルを含まない）、保存する文書のハッシュを比べる SHALL。どれかが変わっていれば、記録せずに、変わったことを日本語で表示し、終了コード 1 を返す SHALL。

Source: REQ-128

#### Scenario: 検査のあいだにファイルが変わる
- **WHEN** 品質コマンドが、追跡しているファイルを書き換える change に `loomake trace record --change c1` を実行する
- **THEN** 何も記録されず、検査のあいだに作業ツリーが変わったことが表示され、終了コードは 1 である

#### Scenario: 除外したファイルだけが変わる
- **WHEN** 品質コマンドが、`.gitignore` で除外したテストのレポートだけを書き出す change に `loomake trace record --change c1` を実行する
- **THEN** 記録される
