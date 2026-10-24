## Context

release ワークフロー（change `prepare-npm-publish` の REQ-140・REQ-141）は、1 つのジョブで checkout・`pnpm install`・ビルド・品質コマンド・`pnpm changeset publish`・`git push --follow-tags` を行う。権限はワークフロー全体に `contents: write` と `id-token: write` を与えている。GitHub Actions では、`id-token: write` を持つジョブのすべてのステップが OIDC のトークンを要求できる。

## Goals / Non-Goals

**Goals:**
- 依存パッケージのスクリプトやビルドのツールが動くジョブに、書き込みの権限と OIDC のトークンを渡さない
- 公開の手順（`changeset publish`、版がすでに npm にあるパッケージを飛ばすこと、タグの作成と push）は変えない

**Non-Goals:**
- ci.yml の変更、SHA の自動更新、environment での承認

## Decisions

### 2 つのジョブに分ける
- `check`：権限は `contents: read`（ワークフロー全体の既定）。未消化の changeset の確認、`pnpm install --frozen-lockfile`、`pnpm build`・`pnpm lint`・`pnpm typecheck`・`pnpm test` を行い、`packages/*/dist` を artifact に上げる
- `publish`：`needs: check`。権限は `contents: write` と `id-token: write`。checkout、npm 11.19.0 の導入、`pnpm install --frozen-lockfile --ignore-scripts`、artifact を `packages/` に下ろす、`pnpm changeset publish`、`git push --follow-tags`

`main` 以外で動かさない条件（`if: github.ref == 'refs/heads/main'`）は、両方のジョブに付ける。

### 渡すのは `dist/` で、tarball ではない
tarball を渡して `npm publish <tarball>` で公開すると、`changeset publish` が行う、npm にある版を飛ばす処理とタグの作成を自分で書くことになる。`dist/` を渡せば、公開のジョブは `changeset publish` をそのまま使え、ビルドのツール（tsc）も動かさずに済む。`dist/` は .gitignore に入っているので、`pnpm publish` の作業ツリーの確認にも引っかからない。

公開のジョブでも `@changesets/cli` と pnpm・npm は動く。これらを動かさずに公開する方法はないので、公開のジョブに残る危険として受け入れる。

### action は SHA で固定し、版をコメントに書く
`uses: actions/checkout@<40 桁の SHA> # v4.x.x` の形にする。SHA は、固定するときの各 action の v4 の最新のタグを `git ls-remote` で調べる。

## Risks / Trade-offs

- [固定した action が古くなる] → 更新は手で行う。Dependabot の導入は別に判断する
- [artifact の受け渡しに失敗して、`dist/` がないまま公開する] → 公開のジョブで、`changeset publish` の前に 5 つの `packages/*/dist/index.js` があることを確かめる
- [`--ignore-scripts` で、公開に要るものが入らない] → 公開のジョブで動くのは `changeset publish` と `pnpm publish` だけで、どちらも依存のスクリプトに頼らない。初回の公開で確かめる
