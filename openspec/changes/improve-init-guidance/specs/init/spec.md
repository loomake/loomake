## MODIFIED Requirements

### Requirement: 基本ファイルの配置
`npx loomake init` は AGENTS.md、CLAUDE.md、loomake.config.json、req-to-openspec Skill（`.claude/skills/req-to-openspec/`）をプロジェクトに配置する SHALL。package.json の dependencies と devDependencies に loomake がないときは、最後に、判定したパッケージマネージャで loomake を開発用の依存に足すコマンドを案内する SHALL。init は package.json を書き換えない MUST。

Source: REQ-019

#### Scenario: 空のプロジェクトで実行する
- **WHEN** 何も置かれていないディレクトリで `loomake init` を実行する
- **THEN** `AGENTS.md`、`CLAUDE.md`、`loomake.config.json`、`.claude/skills/req-to-openspec/SKILL.md` が作られる

#### Scenario: テストのレポートの出力先
- **WHEN** 何も置かれていないディレクトリで `loomake init` を実行する
- **THEN** `loomake.config.json` の `tests.report` が `.loomake/test-report.json` になり、Vitest と Jest でこのファイルに JSON レポートを書き出す設定の例が表示される

#### Scenario: loomake が依存にない
- **WHEN** `packageManager` が `pnpm@9.0.0` で、依存に loomake がない package.json があるプロジェクトで `loomake init` を実行する
- **THEN** 出力に `pnpm add -D loomake` の案内が含まれ、package.json は変更されない

#### Scenario: npm と yarn の案内
- **WHEN** `packageManager` が `npm@10.0.0`、`yarn@4.0.0` の package.json があるプロジェクトで、それぞれ `loomake init` を実行する
- **THEN** 出力にそれぞれ `npm install -D loomake`、`yarn add -D loomake` の案内が含まれる

#### Scenario: loomake が依存にある
- **WHEN** devDependencies に loomake がある package.json のプロジェクトで `loomake init` を実行する
- **THEN** loomake を依存に足す案内は出力されない

### Requirement: パッケージマネージャの判定
`loomake init` は package.json から pnpm・npm・yarn のどれを使っているかを判定し、`loomake.config.json` の `commands` の既定値に反映する SHALL。package.json がないときは、commands を npm の既定値のまま書き、`loomake.config.json` の commands をこのプロジェクトのコマンドに書き換えるよう案内する SHALL。

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
- **THEN** `commands` が `npm run lint`・`npm run typecheck`・`npm test` になり、出力に loomake.config.json の commands を書き換えるよう促す案内が含まれる

#### Scenario: package.json がある
- **WHEN** package.json があるプロジェクトで `loomake init` を実行する
- **THEN** commands を書き換えるよう促す案内は出力されない
