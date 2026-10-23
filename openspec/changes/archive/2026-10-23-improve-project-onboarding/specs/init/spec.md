## ADDED Requirements

### Requirement: Git の除外設定
`loomake init` は、`.gitignore` に、loomake.config.json の `tests.report`（既定は `.loomake/test-report.json`）の行を足す SHALL。`.gitignore` がなければ作り、あれば既存の行を変えずに末尾に足す SHALL。同じ行がすでにあれば足さない SHALL。証拠の記録の置き場（`.loomake/evidence/`）を除外する行は足さない MUST。足したかどうかは、init の結果に表示する SHALL。

Source: REQ-133

#### Scenario: .gitignore がない
- **WHEN** `.gitignore` のないディレクトリで `loomake init` を実行する
- **THEN** `.gitignore` が作られ、`.loomake/test-report.json` の行が入り、結果に `.gitignore` の作成が表示される

#### Scenario: 既存の .gitignore に足す
- **WHEN** `node_modules/` の行だけの `.gitignore` があるディレクトリで `loomake init` を実行する
- **THEN** `.gitignore` は `node_modules/` の行を残したまま、末尾に `.loomake/test-report.json` の行が足される

#### Scenario: すでに除外している
- **WHEN** `.loomake/test-report.json` の行がある `.gitignore` があるディレクトリで `loomake init` を実行する
- **THEN** `.gitignore` は変わらない

#### Scenario: 証拠はコミットできる
- **WHEN** git のリポジトリで `loomake init` を実行する
- **THEN** `.loomake/evidence/c1/x.json` は `.gitignore` で除外されない
