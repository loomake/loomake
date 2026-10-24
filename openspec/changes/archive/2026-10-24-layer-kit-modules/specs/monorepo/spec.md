## ADDED Requirements

### Requirement: kit の中の依存の向き
`@loomake/kit` の実行の基盤（外部プロセスの監視・入力の上限・エラーの型など）は `packages/kit/src/runtime/` に置き、`node:` のモジュール・`@loomake/core`・`runtime/` の中のファイルだけを import する SHALL。機能（`verify/`・`init/`・`doctor/`）は、自分のディレクトリ・`runtime/`・設定の読み込み（`verify/config.ts`）だけを import し、ほかの機能を import しない SHALL。

Source: REQ-207

#### Scenario: 基盤が機能を import しない
- **WHEN** `packages/kit/src/runtime/` のファイルの import を読む
- **THEN** `node:`・`@loomake/core`・`runtime/` の中のファイルだけを import している

#### Scenario: 機能どうしが import しない
- **WHEN** `packages/kit/src/init/` と `packages/kit/src/doctor/` のファイルの import を読む
- **THEN** ほかの機能のディレクトリは、設定の読み込み（`verify/config.ts`）だけを import している
