## ADDED Requirements

### Requirement: 公開するパッケージのメタデータ
公開する 5 つのパッケージ（`@loomake/core`・`@loomake/kit`・`@loomake/trace`・`@loomake/runner`・`loomake`）の `package.json` は、GitHub のリポジトリ `loomake/loomake` を指す `repository`（パッケージのディレクトリを示す `directory` つき）・`homepage`・`bugs` と、空でない `description`、`openspec` を含む `keywords` を持つ SHALL。`loomake` の `description` は、サブコマンドの init・verify・trace・run・doctor をすべて挙げる MUST。

Source: REQ-138

#### Scenario: 5 つのパッケージがメタデータを持つ
- **WHEN** 5 つのパッケージの `package.json` を読む
- **THEN** どれも `repository` の `type` が `git`、`url` が `git+https://github.com/loomake/loomake.git`、`directory` がそのパッケージのディレクトリ（`packages/core` など）で、`homepage` が `https://github.com/loomake/loomake#readme`、`bugs.url` が `https://github.com/loomake/loomake/issues` である
- **AND** `description` が空でなく、`keywords` に `openspec` を含む

#### Scenario: CLI の説明がすべてのサブコマンドを挙げる
- **WHEN** `packages/cli/package.json` の `description` を読む
- **THEN** init・verify・trace・run・doctor をすべて含む

### Requirement: パッケージの README
公開する 5 つのパッケージは、それぞれのディレクトリに `README.md` を持ち、`pnpm pack` で作る tarball に `README.md` が入る SHALL。`loomake` の README は、Loomake が何をするか、`npx loomake init` での始め方、リポジトリの docs へのリンク、実行時に要る外部コマンド `openspec` と `gh` を書く MUST。`@loomake/core`・`@loomake/kit`・`@loomake/trace`・`@loomake/runner` の README は、`loomake` の内部で使うパッケージであることと、版が `0.y.z` の間は API が予告なく変わりうることを書く MUST。

Source: REQ-139

#### Scenario: README が tarball に入る
- **WHEN** 5 つのパッケージそれぞれで `pnpm pack` を実行する
- **THEN** どの tarball にも `package/README.md` が入っている

#### Scenario: CLI の README の内容
- **WHEN** `packages/cli/README.md` を読む
- **THEN** `npx loomake init`、`https://github.com/loomake/loomake` へのリンク、`openspec`、`gh` を含む

#### Scenario: 内部パッケージの README の内容
- **WHEN** core・kit・trace・runner の `README.md` を読む
- **THEN** どれも `loomake` の内部用であることと、`0.y.z` の間は API が変わりうることを書いている

### Requirement: release ワークフローの品質検査と同時実行の制限
release ワークフロー（`.github/workflows/release.yml`）は、公開（`pnpm changeset publish`）の前に `pnpm lint`・`pnpm typecheck`・`pnpm test` を実行し、どれかが失敗したら公開しない SHALL。ワークフローは同時に 1 つだけ動く MUST。実行中のワークフローがあるときに起動したものは、実行中のものを取り消さずに待つ MUST。

Source: REQ-140

#### Scenario: 公開の前に品質コマンドを実行する
- **WHEN** `.github/workflows/release.yml` を読む
- **THEN** `pnpm lint`・`pnpm typecheck`・`pnpm test` のステップが、`pnpm changeset publish` のステップより前にある

#### Scenario: 同時に 1 つだけ動く
- **WHEN** `.github/workflows/release.yml` を読む
- **THEN** `concurrency` が指定され、`cancel-in-progress` が `false` である

### Requirement: release ワークフローの認証
release ワークフローは、npm の Trusted Publishing（OIDC）で公開できるよう、`id-token: write` の権限を持ち、11.5.1 以上の npm で公開する SHALL。リポジトリの secret `NPM_TOKEN` があるときは、それも認証に使える MUST。docs/release.md は、初回は `NPM_TOKEN` で公開し、その後に各パッケージへ Trusted Publisher を登録して `NPM_TOKEN` を外す手順を書く MUST。

Source: REQ-141

#### Scenario: OIDC の権限と npm の版
- **WHEN** `.github/workflows/release.yml` を読む
- **THEN** `permissions` に `id-token: write` があり、公開の前に npm を 11.5.1 以上にするステップがある

#### Scenario: 初回と 2 回目以降の手順
- **WHEN** `docs/release.md` を読む
- **THEN** 初回を `NPM_TOKEN` で公開する手順と、Trusted Publisher を登録して `NPM_TOKEN` を外す手順がある
