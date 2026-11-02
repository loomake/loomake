## MODIFIED Requirements

### Requirement: パッケージマネージャの判定
`loomake init` は package.json から pnpm・npm・yarn のどれを使っているかを判定し、`loomake.config.json` の `commands` の既定値に反映する SHALL。package.json がないときは、commands を npm の既定値のまま書き、`loomake.config.json` の commands をこのプロジェクトのコマンドに書き換えるよう案内する SHALL。書き換えの案内には「書き換えるまで、loomake doctor は test の script を確かめられず問題として出します」の 1 文を加える SHALL。

Source: REQ-024

#### Scenario: pnpm のプロジェクト
- **WHEN** `packageManager` が `pnpm@9.0.0` の package.json があるプロジェクトで `loomake init` を実行する
- **THEN** `loomake.config.json` の `commands` が `pnpm lint`・`pnpm typecheck`・`pnpm test` になる

#### Scenario: npm のプロジェクト
- **WHEN** `packageManager` が `npm@10.0.0` の package.json があるプロジェクトで `loomake init` を実行する
- **THEN** `commands` が `npm run lint`・`npm run typecheck`・`npm test` になる

#### Scenario: yarn のプロジェクト
- **WHEN** `packageManager` が `yarn@4.0.0` の package.json があるプロジェクトで `loomake init` を実行する
- **THEN** `commands` が `yarn lint`・`yarn typecheck`・`yarn test` になる

#### Scenario: package.json がない
- **WHEN** package.json のないプロジェクトで `loomake init` を実行する
- **THEN** `commands` が `npm run lint`・`npm run typecheck`・`npm test` になり、出力に loomake.config.json の commands を書き換えるよう促す案内と「書き換えるまで、loomake doctor は test の script を確かめられず問題として出します」の 1 文が含まれる

#### Scenario: package.json がある
- **WHEN** package.json があるプロジェクトで `loomake init` を実行する
- **THEN** commands を書き換えるよう促す案内は出力されない
