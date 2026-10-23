# prepare-npm-publish

## Why
npm に公開する準備が足りていない。package.json にリポジトリへのリンクと説明がなく、tarball に README が入らないので、npm のページが空になる。release ワークフローは品質検査をせずに公開でき、同時に 2 回動かせて、認証は `NPM_TOKEN` しか使えない。docs/release.md の「公開前に直すべきこと」1〜4 で指摘した。

## What Changes
- 5 つのパッケージの package.json に `repository`（`directory` つき）・`homepage`・`bugs`・`description`・`keywords` を書く（REQ-138）
- 5 つのパッケージに README を置き、tarball に入るようにする。`loomake` の README には、何をするか・`npx loomake init`・docs へのリンク・実行時に要る `openspec` と `gh` を書く。中の 4 つには、内部用であることと、`0.y.z` の間は API が変わりうることを書く（REQ-139）
- release ワークフローは、公開の前に lint・typecheck・test を実行し、同時には 1 つしか動かないようにする（REQ-140）
- release ワークフローに `id-token: write` を与え、Trusted Publishing（OIDC）で公開できるようにする。初回の公開は `NPM_TOKEN` で行い、その後 Trusted Publisher を登録してトークンを外す手順を docs/release.md に書く（REQ-141）

## Non-goals
- npm への実際の公開、`@loomake` organization の作成、Trusted Publisher の登録
- Node の下限の変更、changeset の整理、版を揃えるかどうか（docs/release.md の 5・6。判断待ち）
- CI でパッケージを pack して動かすジョブ、`@loomake/source` 条件の扱い（docs/release.md の「やった方がいいこと」）
- リポジトリを public にすること

## Capabilities

### New Capabilities
なし

### Modified Capabilities
- `monorepo`：公開するパッケージのメタデータと README、release ワークフローの Requirement を足す

## Impact
- 影響するコード：`packages/*/package.json`、`packages/*/README.md`（新規）、`.github/workflows/release.yml`、`docs/release.md`、`tests/monorepo.test.ts`
- 実行時の依存は変わらない
