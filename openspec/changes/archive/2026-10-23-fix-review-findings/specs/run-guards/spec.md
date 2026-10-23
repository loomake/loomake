## MODIFIED Requirements

### Requirement: 設定の変更の検出
エンジンの変更に、loomake.config.json、`eslint.config.*`・`.eslintrc*`、`tsconfig*.json`、`vitest.config.*`・`vitest.workspace.*`・`vite.config.*`、`jest.config.*` の変更か、リポジトリの中のどの階層にある package.json でも `scripts` の値の変更があれば、`loomake run` はその変更をコミットせずに止まる SHALL。

Source: REQ-110

#### Scenario: loomake.config.json を変える
- **WHEN** エンジンが loomake.config.json の commands を書き換えて終える
- **THEN** run は止まり、loomake.config.json の差分が表示され、終了コードは 1 である

#### Scenario: package.json の scripts を変える
- **WHEN** エンジンが package.json の `scripts.test` を書き換えて終える
- **THEN** run は止まる

#### Scenario: 子パッケージの package.json の scripts を変える
- **WHEN** エンジンが `packages/app/package.json` の `scripts.test` を書き換えて終える
- **THEN** run は止まる

#### Scenario: package.json の依存だけを変える
- **WHEN** エンジンが package.json の `dependencies` だけを書き換えて終える
- **THEN** run は止まらずにコミットする
