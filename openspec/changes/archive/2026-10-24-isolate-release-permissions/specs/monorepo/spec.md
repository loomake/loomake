## ADDED Requirements

### Requirement: release ワークフローの権限の分離
release ワークフロー（`.github/workflows/release.yml`）は、品質コマンドを実行するジョブと、公開するジョブを分ける SHALL。ワークフロー全体の `permissions` は `contents: read` だけにし、`id-token: write` と `contents: write` は公開のジョブだけが持つ MUST。公開のジョブは、品質のジョブが合格したときだけ動き（`needs`）、`pnpm install` を `--ignore-scripts` つきで実行し、品質のジョブでビルドしたものを受け取って公開する MUST。公開のジョブは `pnpm build` を実行しない MUST。

Source: REQ-143

#### Scenario: 書き込みの権限は公開のジョブだけにある
- **WHEN** `.github/workflows/release.yml` を読む
- **THEN** ワークフロー全体の `permissions` は `contents: read` だけである
- **AND** `id-token: write` と `contents: write` は、`pnpm changeset publish` を実行するジョブの `permissions` にだけある

#### Scenario: 公開のジョブは品質のジョブのあとに、スクリプトを実行せずに動く
- **WHEN** `.github/workflows/release.yml` の、`pnpm changeset publish` を実行するジョブを読む
- **THEN** `needs` に、`pnpm lint`・`pnpm typecheck`・`pnpm test` を実行するジョブがある
- **AND** `pnpm install` に `--ignore-scripts` が付いている
- **AND** `pnpm build` を実行せず、品質のジョブが上げたビルドの結果を受け取る

### Requirement: release ワークフローの action の固定
release ワークフローが `uses` で使う action は、コミットの SHA（40 桁の 16 進数）で指定する SHALL。

Source: REQ-143

#### Scenario: action をコミットの SHA で指定する
- **WHEN** `.github/workflows/release.yml` の `uses` をすべて読む
- **THEN** どれも `@` のあとが 40 桁の 16 進数である
