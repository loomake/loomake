## MODIFIED Requirements

### Requirement: kit の中の依存の向き
`@loomake/kit` の実行の基盤（外部プロセスの監視・入力の上限・エラーの型など）は `packages/kit/src/runtime/` に置き、`node:` のモジュール・`@loomake/core`・`yaml`・`runtime/` の中のファイルだけを import する SHALL。機能（`verify/`・`init/`・`doctor/`）は、自分のディレクトリ・`runtime/`・設定の読み込み（`verify/config.ts`）だけを import し、ほかの機能を import しない SHALL。kit の外部のパッケージとして import してよいのは、`node:` のモジュール・`@loomake/core`・`yaml` だけとする SHALL。`@loomake/kit`（自分の公開の入口）やほかのパッケージを経由して import しない MUST。

Source: REQ-207

#### Scenario: 基盤が機能を import しない
- **WHEN** `packages/kit/src/runtime/` のファイルの import を読む
- **THEN** `node:`・`@loomake/core`・`yaml`・`runtime/` の中のファイルだけを import している

#### Scenario: 機能どうしが import しない
- **WHEN** `packages/kit/src/init/` と `packages/kit/src/doctor/` のファイルの import を読む
- **THEN** ほかの機能のディレクトリは、設定の読み込み（`verify/config.ts`）だけを import している

#### Scenario: yaml の import を認める
- **WHEN** 依存の向きの検査に、`runtime/` または機能のディレクトリのファイルが `yaml` を import する文を渡す
- **THEN** 検査はその import を決まりに反するものとして返さない

#### Scenario: これまでの禁止の例を引き続き拒否する
- **WHEN** 依存の向きの検査に、`runtime/` から機能への import、機能から別の機能への import（設定の読み込みの `verify/config.ts` を除く）、`@loomake/kit` やほかのパッケージ（`@loomake/trace` など）の import を渡す
- **THEN** 検査はどれも決まりに反する import として返す
