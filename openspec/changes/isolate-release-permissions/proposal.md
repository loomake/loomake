# isolate-release-permissions

## Why
release ワークフローは、`id-token: write` と `contents: write` をワークフロー全体に持つ。そのため、`pnpm install` で依存パッケージのスクリプトが動くあいだも、OIDC のトークンを取れ、リポジトリに書き込める。依存のどれかが乗っ取られると、Trusted Publisher の権限で Loomake のパッケージを公開されるおそれがある。初回の公開の前に、書き込みの権限を公開のステップの近くだけに絞る（docs/release.md の「やった方がいいこと」）。

## What Changes
- release ワークフローを、品質のジョブと公開のジョブに分ける。ワークフロー全体の権限は `contents: read` だけにし、`id-token: write` と `contents: write` は公開のジョブだけが持つ（REQ-143）
- 公開のジョブは、品質のジョブが合格したときだけ動く。依存パッケージのスクリプトを実行せずにインストールし（`--ignore-scripts`）、品質のジョブでビルドした `dist/` を受け取って公開する。公開のジョブではビルドしない（REQ-143）
- release ワークフローが使う action を、コミットの SHA で固定する（REQ-143）

## Non-goals
- ci.yml の action の固定と権限の見直し（ci.yml は公開の権限を持たない）
- Dependabot などで、固定した SHA を更新する仕組み
- GitHub の environment での承認（リポジトリを public にしてから。prepare-npm-publish の Q-01）
- 公開の方法（`changeset publish`）と認証の方法（REQ-141）の変更

## Capabilities

### New Capabilities
なし

### Modified Capabilities
- `monorepo`：release ワークフローの権限の分け方と action の固定の Requirement を足す

## Impact
- 影響するコード：`.github/workflows/release.yml`、`tests/monorepo.test.ts`、`docs/release.md`
- 公開の手順（GitHub 上から release ワークフローを main で実行する）は変わらない
- change `prepare-npm-publish`（REQ-140・REQ-141）の release ワークフローを前提にする。同じブランチ `prepare-npm-publish-2` に入れ、prepare-npm-publish のあとに archive する
