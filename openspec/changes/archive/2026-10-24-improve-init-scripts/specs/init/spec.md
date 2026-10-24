## ADDED Requirements

### Requirement: 実在する script に合わせた commands
`loomake init` は、package.json に `scripts` のオブジェクトがあるとき、`commands` には lint・typecheck・test のうち、`scripts` に空でない文字列で定義された名前のコマンドだけを書く SHALL。書かなかった名前があるときは、その名前と、script を足したら `loomake.config.json` の commands にも書くことを日本語で案内する SHALL。package.json がないときと、`scripts` がないときは、これまでどおり 3 つのコマンドを書く SHALL。

Source: REQ-196

#### Scenario: test だけがある
- **WHEN** `scripts` に test だけがある package.json のプロジェクトで `loomake init` を実行する
- **THEN** `commands` は test だけになり、出力に lint と typecheck を書かなかったことの案内が含まれる

#### Scenario: すべてある
- **WHEN** `scripts` に lint・typecheck・test がある package.json のプロジェクトで `loomake init` を実行する
- **THEN** `commands` は 3 つになり、書かなかった名前の案内は出力されない

#### Scenario: scripts がない
- **WHEN** `scripts` のない package.json のプロジェクトで `loomake init` を実行する
- **THEN** `commands` は 3 つになる

### Requirement: 使っているテストランナーの設定例
`loomake init` は、package.json の dependencies か devDependencies に vitest があれば Vitest の設定例だけを、jest があれば Jest の設定例だけを表示する SHALL。両方あれば両方を、どちらもなければこれまでどおり両方を表示する SHALL。

Source: REQ-197

#### Scenario: vitest を使っている
- **WHEN** devDependencies に vitest がある package.json のプロジェクトで `loomake init` を実行する
- **THEN** Vitest の設定例が表示され、Jest の設定例は表示されない

#### Scenario: jest を使っている
- **WHEN** devDependencies に jest がある package.json のプロジェクトで `loomake init` を実行する
- **THEN** Jest の設定例が表示され、Vitest の設定例は表示されない

#### Scenario: どちらもない
- **WHEN** package.json のないプロジェクトで `loomake init` を実行する
- **THEN** Vitest と Jest の両方の設定例が表示される
