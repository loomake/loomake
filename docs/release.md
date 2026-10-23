# npm 公開前の確認結果

2026-10-23 時点のブランチ `prepare-npm-publish-2`（`4c22f3b`）で確かめた結果をまとめる。このブランチには公開の準備のための change `prepare-npm-publish`（REQ-138〜REQ-141）と `require-node-22`（REQ-142）が入っている。main にはまだ入っていない。

## 確かめたこと

- 5 つのパッケージをビルドして `pnpm pack` した。どの tarball にも `README.md`・`LICENSE`・`dist/` が入り、core には `schema/`、kit には `templates/` も入る。`workspace:*` は具体的な版に置き換わる
- publint は 5 つとも「All good」
- git だけを初期化した新しいプロジェクトに 5 つの tarball を入れて動かした
  - `loomake --version`・`init`・`verify --help`・`trace --help` は終了コード 0
  - `doctor` は openspec/ がないことを問題として示し、終了コード 1。`run --dry-run --change x` は change がないことを示し、終了コード 2。どちらも想定どおり
  - Node 22.12.0 でも、`--version` と `doctor` が動いた
- 両方の change の完了ゲート（`pnpm -s verify --change <id> --done`）は合格。`pnpm -s test` は 312 件すべて合格
- GitHub のリポジトリ `loomake/loomake` は PRIVATE。release ワークフローが使う secret の `NPM_TOKEN` は、まだ登録されていない。private のため、main のブランチ保護も設定できない（GitHub の無料プランでは使えない）
- npm で `loomake`・`loom-make`・`loomakes` は 404 が返る。似た名前の `lomake` は既にある
- `@arethetypeswrong/cli` は道具のエラーで実行できず、型の解決は確かめていない

## 対応済みのこと

前回の確認で挙げた項目は、次のように対応した。

- package.json の `repository`・`homepage`・`bugs`・`description`・`keywords`（REQ-138）
- 5 つのパッケージの README。`loomake` には使い方と外部コマンド（`openspec`・`gh`・`claude`）、`--skip-permissions` の注意を書いた。内部用の 4 つには、版が `0.y.z` のあいだは API が予告なく変わりうることを書いた（REQ-139）
- release ワークフローは公開の前に lint・typecheck・test を実行し、同時には 1 つしか動かない（REQ-140）
- release ワークフローは `id-token: write` を持ち、npm を 11.19.0 に固定して入れる。`NPM_TOKEN` でも OIDC でも公開できる（REQ-141）
- `engines.node` を `>=22.12.0` に上げ、CI の `node20` ジョブを `node22` ジョブにした（REQ-142）
- 未消化の changeset を、初版の 1 つ（`.changeset/initial-release.md`）にまとめた。5 つとも 0.1.0 になる。版をそろえる `fixed` は使わず、REQ-056 のとおりパッケージごとに独立した版のままにした

## 判断が要ること

### リポジトリを公開前に public にするか

change `prepare-npm-publish` の確認事項 Q-01 で、まだ答えがない。おすすめは public にすること。private のままだと、次の問題が残る。

- npm のページにある README・`homepage`・`bugs` のリンクを、利用者が開けない
- OIDC で公開しても provenance が付かない
- main のブランチ保護を設定できない。書き込み権限があれば、release ワークフローの前提である main に直接 push できてしまう

public にする前に、コミットの履歴に秘密情報が入っていないかを確かめる。

## 公開の手順

### 準備

1. ブランチ `prepare-npm-publish-2` の PR を作って main に入れる。PR 本文には `loomake-change: prepare-npm-publish, require-node-22` を書く
2. npm で `@loomake` organization を作り、公開権限を持つメンバーを決める
3. `pnpm changeset version` を実行して版を上げ、PR を作って main に入れる。package.json を変えるので、PR 本文には `loomake-change: none` を書く。書かないと CI の gate ジョブが失敗する

### 初回の公開と、2 回目以降の認証

npm の Trusted Publishing（OIDC）で公開すれば、トークンの管理が要らない。ただし、まだ存在しないパッケージには Trusted Publisher を登録できない。そこで、初回だけ `NPM_TOKEN` で公開し、そのあと OIDC に切り替える。

初回の公開：

1. 公開の権限がある有効期限の短いトークンを作り、GitHub の secrets に `NPM_TOKEN` として登録する
2. GitHub 上から release ワークフローを main で実行する。手元からは公開しない。品質コマンドと、公開するコミットの確認を通らないため
3. `loomake` の名前が拒否されたら、ワークフローは途中で失敗する。npm は既にある名前と似すぎた名前を拒むことがあり、`lomake` があるためその可能性は残る。拒否されたら名前を決め直す

2 回目以降の公開：

1. npm で 5 つのパッケージそれぞれに Trusted Publisher を登録する（リポジトリ `loomake/loomake`、ワークフロー `release.yml`）
2. GitHub の secrets から `NPM_TOKEN` を外し、npm でもトークンを無効にする。secret がなければ `NODE_AUTH_TOKEN` は空になり、npm は OIDC で認証する
3. 次の公開で、OIDC で公開できたかを確かめる。`changeset publish` は pnpm のワークスペースでは `pnpm publish` を呼ぶが、pnpm（12.10.1）が OIDC での公開に対応しているかは未確認。できなければ change を作り、公開の方法を `npm publish` に替える

Trusted Publishing には npm 11.5.1 以上と Node 22.14.0 以上が要る。release ワークフローは Node 24 を使い、npm を 11.19.0 に固定して入れるので、条件を満たす。

参考：[Changesets の公開手順](https://github.com/changesets/changesets/blob/main/site/guide/versioning-and-publishing.md)、[npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers/)

### 公開のあとに確かめること

- 新しいプロジェクトで `npx loomake@latest --version` と `npx loomake init` が動く
- npm のページに README が出て、リンクが開ける
- 2 回目以降は、npm のページに provenance が出る（リポジトリが public のとき）

## やった方がいいこと

- **pack して動かす CI**：「pack → 新しいプロジェクトに入れる → `init`・`verify`・`doctor` を実行」をジョブにする。今回手で行った確認を自動にでき、`files` の漏れ（templates・schema）を公開前に見つけられる。publint も足す
- **`@loomake/source` 条件**：各パッケージの `exports` にあるこの条件は、tarball に入っていない `./src/index.ts` を指す。利用者がこの条件を有効にしなければ影響はないが、公開する package.json から外す方法を検討する
- **ビルド前に `dist/` を消す**：ソースを消したとき、古い `dist/` のファイルが手元のビルドに残る。release ワークフローはまっさらな状態でビルドするので、公開物には影響しない
- **`SECURITY.md`**：脆弱性の報告先を決めておく
- **古いブランチの片づけ**：古い main がもとのブランチ `prepare-npm-publish` は、`prepare-npm-publish-2` に置き換えた。ほかのセッションのワークツリーで使われているので、そのセッションの作業が終わってから消す
- **任意**：`declarationMap` と `sourceMap` を出すと、利用者が型定義から元のコードへ飛べる
