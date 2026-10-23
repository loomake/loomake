# monorepo Specification

## Purpose
Loomake の core・kit・CLI を、1 つの pnpm workspaces のモノレポで開発するための構成を定める。開発環境（devcontainer）、Node.js のバージョン、3 つの OS での CI とプルリクエストごとの完了ゲート、changesets による公開の準備、ライセンスを含む。

## Requirements

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
リポジトリは `.devcontainer/devcontainer.json` を持ち、Node 24 のイメージを使い、コンテナ作成後に OpenSpec CLI をインストールする SHALL。

Source: REQ-004, REQ-061

#### Scenario: devcontainer の定義がある
- **WHEN** `.devcontainer/devcontainer.json` を読む
- **THEN** ファイルが存在し、`postCreateCommand` に `@fission-ai/openspec` のインストールが含まれる

#### Scenario: Node 24 のイメージ
- **WHEN** `.devcontainer/devcontainer.json` の `image` を読む
- **THEN** Node 24 系のイメージが指定されている

### Requirement: Node.js のバージョン宣言
ルートと各パッケージの `package.json` は、`engines.node` に `>=20.19.0` を宣言する SHALL。

Source: REQ-048

#### Scenario: engines が宣言されている
- **WHEN** ルート、`packages/core`、`packages/kit`、`packages/cli` の `package.json` を読む
- **THEN** すべての `engines.node` が `>=20.19.0` である

### Requirement: 3 つの OS での CI
CI は ubuntu-latest・macos-latest・windows-latest の 3 つで `pnpm test` を実行する SHALL。

Source: REQ-049

#### Scenario: ワークフローが 3 OS を指定している
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** ジョブのマトリクスに ubuntu-latest・macos-latest・windows-latest が含まれる

### Requirement: プルリクエストごとの完了ゲート
CI はプルリクエストごとに完了ゲートを実行し、不合格のときジョブを失敗させる SHALL。対象の change は「完了ゲートの対象の決め方」に従って決め、対象の change ごとに `--change <id> --done` で実行し、1 つでも不合格ならジョブを失敗させる MUST。対象の change がないときは、「対象の change がない PR の扱い」に従う MUST。

Source: REQ-010, REQ-054, REQ-132

#### Scenario: ブランチ名が change-id と一致する
- **WHEN** ブランチ名 `setup-monorepo` の PR で CI が動く
- **THEN** `verify --change setup-monorepo --done` が実行され、不合格ならジョブが失敗する

#### Scenario: run のブランチ名
- **WHEN** `openspec/changes/c1` があり、ブランチ名 `loomake/c1` の PR で CI が動く
- **THEN** `verify --change c1 --done` が実行される

#### Scenario: PR 本文で明示する
- **WHEN** `openspec/changes/c1` と `openspec/changes/c2` があり、ブランチ名 `fix-typo` で、本文に `loomake-change: c1, c2` の行がある PR で CI が動く
- **THEN** `verify --change c1 --done` と `verify --change c2 --done` が実行される

#### Scenario: 明示した change がない
- **WHEN** 本文に `loomake-change: nothing` の行があり、`openspec/changes/nothing` がない PR で CI が動く
- **THEN** change がないことが表示され、ジョブが失敗する

#### Scenario: change のない PR だと明示する
- **WHEN** 本文に `loomake-change: none` の行があり、`packages/a.ts` を変えた PR で CI が動く
- **THEN** `--change` なしで品質コマンドだけが実行される

#### Scenario: 変えたファイルから決める
- **WHEN** ブランチ名 `feature-x` で、`openspec/changes/c1/tasks.md` と `packages/a.ts` を変えた PR で CI が動く
- **THEN** `verify --change c1 --done` が実行される

#### Scenario: コードを変えて対象を特定できない
- **WHEN** ブランチ名 `fix-typo` で、本文に明示がなく、`packages/a.ts` を変えた PR で CI が動く
- **THEN** `loomake-change:` の行を書くよう案内が表示され、ジョブが失敗する

#### Scenario: ブランチ名が change-id と一致しない
- **WHEN** ブランチ名 `fix-typo` で、本文に明示がなく、`docs/usage.md` だけを変えた PR で CI が動く
- **THEN** `--change` なしで品質コマンドだけが実行される

#### Scenario: archive の PR
- **WHEN** ブランチ名 `archive-c1` で、`openspec/changes/c1/` の削除と、`openspec/changes/archive/2026-10-23-c1/` と `openspec/specs/` の追加と変更だけの PR で CI が動く
- **THEN** `--change` なしで品質コマンドだけが実行される

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

### Requirement: 完了ゲートの対象の決め方
CI の完了ゲートは、対象の change を次の順に決める MUST。

1. PR 本文に `loomake-change: <id>` の行があれば、その change とする。`,` で区切って複数を書ける。`loomake-change: none` なら、change のない PR とする
2. 明示がなければ、PR で変えたファイルのうち `openspec/changes/<id>/` の下にあるもの（`archive` を除き、いまディレクトリがあるもの）の change と、PR のブランチ名、またはブランチ名から先頭の `loomake/` を除いた名前と一致する `openspec/changes/<id>` の change を合わせたものとする

明示した change のディレクトリがないときは、ジョブを失敗させる MUST。

Source: REQ-132

#### Scenario: 明示を優先する
- **WHEN** `openspec/changes/c1` と `openspec/changes/c2` があり、ブランチ名 `c2` で、`openspec/changes/c2/tasks.md` を変え、本文に `loomake-change: c1` の行がある PR で CI が動く
- **THEN** `verify --change c1 --done` だけが実行される

#### Scenario: 変えたファイルとブランチ名を合わせる
- **WHEN** `openspec/changes/c1` と `openspec/changes/c2` があり、ブランチ名 `c2` で、本文に明示がなく、`openspec/changes/c1/tasks.md` を変えた PR で CI が動く
- **THEN** `verify --change c1 --done` と `verify --change c2 --done` が実行される

### Requirement: 対象の change がない PR の扱い
対象の change がなく、`loomake-change: none` の明示があるか、PR で変えたファイルが文書（`.md` のファイル、`docs/`・`openspec/`・`.changeset/` の下のファイル）だけのときは、CI は品質コマンドだけを実行する MUST。対象の change がなく、文書のほかのファイルを変えているときは、`loomake-change:` の行を書くよう日本語で案内し、ジョブを失敗させる MUST。

Source: REQ-132

#### Scenario: changeset と README だけの PR
- **WHEN** ブランチ名 `fix-typo` で、本文に明示がなく、`README.md` と `.changeset/x.md` だけを変えた PR で CI が動く
- **THEN** `--change` なしで品質コマンドだけが実行される

#### Scenario: 文書とコードを変えた PR
- **WHEN** ブランチ名 `fix-typo` で、本文に明示がなく、`docs/usage.md` と `packages/a.ts` を変えた PR で CI が動く
- **THEN** `loomake-change:` の行を書くよう案内が表示され、ジョブが失敗する
