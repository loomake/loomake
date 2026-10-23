## MODIFIED Requirements

### Requirement: 実行時依存の範囲
`@loomake/kit` の実行時依存は `@loomake/core` のみとし、`loomake` の実行時依存は `@loomake/core`・`@loomake/kit`・`@loomake/trace`・`@loomake/runner` のみとする SHALL。

Source: REQ-047

#### Scenario: kit の依存
- **WHEN** `packages/kit/package.json` の `dependencies` を読む
- **THEN** `@loomake/core` だけが含まれる

#### Scenario: loomake の依存
- **WHEN** `packages/cli/package.json` の `dependencies` を読む
- **THEN** `@loomake/core`・`@loomake/kit`・`@loomake/trace`・`@loomake/runner` 以外が含まれない
