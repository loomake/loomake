## REMOVED Requirements

### Requirement: 実行時依存ゼロ
**Reason**: 利用者が core の実行時依存に Zod を採ると決めた（ADR 0003、change record-stack-and-versioning-decisions の Q-01 の回答 A）。core の外部の実行時依存を `zod` だけとする Requirement「core の実行時依存の範囲」に置き換える。OpenSpec の MODIFIED では Scenario「dependencies が空」を消せないため、REMOVED と ADDED で置き換える
**Source**: REQ-046

## ADDED Requirements

### Requirement: core の実行時依存の範囲
`@loomake/core` の外部の実行時依存は `zod` だけとする SHALL。`@loomake/core` の `package.json` の `dependencies` は `zod` 以外のパッケージを含まない MUST。

Source: REQ-046

#### Scenario: zod 以外の依存がない
- **WHEN** `packages/core/package.json` の `dependencies` を読む
- **THEN** `zod` 以外のパッケージが含まれない（`dependencies` が存在しないか空のときも、この条件を満たす）
