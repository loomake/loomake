## ADDED Requirements

### Requirement: モノレポのパッケージ構成
リポジトリは pnpm workspaces のモノレポであり、`packages/core`（`@loomake/core`）、`packages/kit`（`@loomake/kit`）、`packages/cli`（CLI 本体 `loomake`）を持つ SHALL。ワークスペースは `pnpm-workspace.yaml` の `packages/*` で定義する MUST。`loomake` は `bin` に `loomake` コマンドを宣言する MUST。

Source: REQ-001, REQ-002, REQ-003, REQ-060

#### Scenario: 3 つのパッケージが認識される
- **WHEN** `pnpm install` のあとに `pnpm -r ls --depth -1 --json` を実行する
- **THEN** `@loomake/core`・`@loomake/kit`・`loomake` が出力に含まれる

#### Scenario: CLI のコマンド名
- **WHEN** `packages/cli/package.json` を読む
- **THEN** `name` が `loomake` で、`bin.loomake` が宣言されている

### Requirement: devcontainer
リポジトリは `.devcontainer/devcontainer.json` を持ち、Node 24 のイメージを使い、コンテナ作成後に OpenSpec CLI と要件書の読み取り用ツール（pandoc・poppler-utils・xlsx2csv）をインストールする SHALL。

Source: REQ-004, REQ-061

#### Scenario: devcontainer の定義がある
- **WHEN** `.devcontainer/devcontainer.json` を読む
- **THEN** ファイルが存在し、`postCreateCommand` に `@fission-ai/openspec` のインストールが含まれる

#### Scenario: Node 24 のイメージ
- **WHEN** `.devcontainer/devcontainer.json` の `image` を読む
- **THEN** Node 24 系のイメージが指定されている

#### Scenario: 読み取り用ツール
- **WHEN** `.devcontainer/devcontainer.json` の `postCreateCommand` を読む
- **THEN** `pandoc`・`poppler-utils`・`xlsx2csv` のインストールが含まれる

### Requirement: Node.js のバージョン宣言
ルートと各パッケージの `package.json` は、`engines.node` に `>=20.19.0` を宣言する SHALL。

Source: REQ-048

#### Scenario: engines が宣言されている
- **WHEN** ルート、`packages/core`、`packages/kit` の `package.json` を読む
- **THEN** すべての `engines.node` が `>=20.19.0` である

### Requirement: 3 つの OS での CI
CI は ubuntu-latest・macos-latest・windows-latest の 3 つで `pnpm test` を実行する SHALL。

Source: REQ-049

#### Scenario: ワークフローが 3 OS を指定している
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** ジョブのマトリクスに ubuntu-latest・macos-latest・windows-latest が含まれる

### Requirement: プルリクエストごとの完了ゲート
CI はプルリクエストごとに完了ゲートを実行し、不合格のときジョブを失敗させる SHALL。PR のブランチ名が `openspec/changes/<id>` のディレクトリ名と一致するときは `--change <id> --done` で実行し、一致しないときは品質コマンドだけを実行する MUST。

Source: REQ-010, REQ-054

#### Scenario: ブランチ名が change-id と一致する
- **WHEN** ブランチ名 `setup-monorepo` の PR で CI が動く
- **THEN** `verify --change setup-monorepo --done` が実行され、不合格ならジョブが失敗する

#### Scenario: ブランチ名が change-id と一致しない
- **WHEN** ブランチ名 `fix-typo` の PR で CI が動く
- **THEN** `--change` なしで品質コマンド（lint・typecheck・test）だけが実行される

### Requirement: changesets による公開準備
リポジトリは changesets を設定し、パッケージごとに独立したバージョンで公開できる状態にする SHALL。

Source: REQ-056

#### Scenario: changesets が設定されている
- **WHEN** `.changeset/config.json` を読む
- **THEN** ファイルが存在し、`pnpm changeset status` がエラーなく終わる

### Requirement: MIT ライセンス
リポジトリは MIT ライセンスの `LICENSE` を持ち、各 `package.json` の `license` を `MIT` にする SHALL。

Source: REQ-057

#### Scenario: ライセンスが MIT である
- **WHEN** `LICENSE` とルート・各パッケージの `package.json` を読む
- **THEN** `LICENSE` が MIT ライセンス本文であり、すべての `license` が `MIT` である
