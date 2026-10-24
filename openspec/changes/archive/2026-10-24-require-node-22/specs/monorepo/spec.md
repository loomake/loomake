## MODIFIED Requirements

### Requirement: Node.js のバージョン宣言
ルートと各パッケージの `package.json` は、`engines.node` に `>=22.12.0` を宣言する SHALL。CI は、Node 22.12.0 でビルドした CLI が動くかを確かめる MUST。

Source: REQ-142

#### Scenario: engines が宣言されている
- **WHEN** ルートと `packages/core`・`packages/kit`・`packages/trace`・`packages/runner`・`packages/cli` の `package.json` を読む
- **THEN** すべての `engines.node` が `>=22.12.0` である

#### Scenario: CI が下限の版で CLI を動かす
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** Node 22.12.0 で `packages/cli/dist/cli.js` を実行するジョブがある
