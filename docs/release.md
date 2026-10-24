# npm への公開

5 つのパッケージ（`loomake`・`@loomake/core`・`@loomake/kit`・`@loomake/trace`・`@loomake/runner`）を npm に公開する手順をまとめる。公開の前に確かめた結果は、作業の記録（`docs/worklog/`）に残す。

## 公開の前に決めること

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

### release ワークフローがすること

release ワークフローは、2 つのジョブで公開する。

1. `check` のジョブは、未消化の changeset がないことを確かめ、ビルドと lint・typecheck・test を実行する。ビルドした `dist/` を、次のジョブに渡す。このジョブは、リポジトリを読む権限しか持たない
2. `publish` のジョブは、`check` が合格したときだけ動く。依存パッケージのスクリプトを実行せずにインストールし（`--ignore-scripts`）、受け取った `dist/` を `pnpm changeset publish` で公開して、タグを push する。OIDC のトークンとリポジトリへの書き込みの権限は、このジョブだけが持つ

ワークフローが使う action は、コミットの SHA で固定している。action の版を上げるときは、新しいタグが指すコミットの SHA に書き換え、コメントの版も直す。

### 初回の公開と、2 回目以降の認証

npm の Trusted Publishing（OIDC）で公開すれば、トークンの管理が要らない。ただし、まだ存在しないパッケージには Trusted Publisher を登録できない。そこで、初回だけ `NPM_TOKEN` で公開し、そのあと OIDC に切り替える。

初回の公開：

1. 公開の権限がある有効期限の短いトークンを作り、GitHub の secrets に `NPM_TOKEN` として登録する。トークンは次の条件で作る
   - 種類は granular access token にする
   - まだない 5 つのパッケージを作れるよう、対象を「すべてのパッケージ」にし、読み書きの権限を付ける。パッケージを選ぶ形では、まだない `loomake` を選べない
   - ワークフローから使うので、公開のときに 2FA を求めない設定にする
   - トークンの有効期限の上限や 2FA の扱いは変わることがあるので、作るときに npm の文書で確かめる
2. GitHub 上から release ワークフローを main で実行する。手元からは公開しない。品質コマンドと、公開するコミットの確認を通らないため
3. `loomake` の名前が拒否されたら、ワークフローは途中で失敗する。npm は既にある名前と似すぎた名前を拒むことがあり、`lomake` があるためその可能性は残る。拒否されたら名前を決め直す

2 回目以降の公開：

1. npm で 5 つのパッケージそれぞれに Trusted Publisher を登録する（リポジトリ `loomake/loomake`、ワークフロー `release.yml`）
2. GitHub の secrets から `NPM_TOKEN` を外し、npm でもトークンを無効にする。secret がなければ `NODE_AUTH_TOKEN` は空になり、npm は OIDC で認証する
3. 次の公開で、OIDC で公開できたかを確かめる。`changeset publish` は pnpm のワークスペースでは `pnpm publish` を呼ぶが、pnpm（12.10.1）が OIDC での公開に対応しているかは未確認。できなければ change を作り、公開の方法を `npm publish` に替える
4. OIDC で公開できたら、npm で 5 つのパッケージそれぞれの Publishing access を「Require two-factor authentication and disallow tokens」にする。トークンが漏れても、そのトークンでは公開できなくなる。Trusted Publishing での公開は、この設定でも続けられる

Trusted Publishing には npm 11.5.1 以上と Node 22.14.0 以上が要る。release ワークフローは Node 24 を使い、npm を 11.19.0 に固定して入れるので、条件を満たす。

参考：[Changesets の公開手順](https://github.com/changesets/changesets/blob/main/site/guide/versioning-and-publishing.md)、[npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers/)

### 公開が途中で失敗したとき

`changeset publish` は 5 つのパッケージを順に公開する。途中で失敗すると、一部のパッケージだけが npm に載る。そのあとの `git push --follow-tags` も実行されないので、公開できたパッケージのタグは GitHub に残らない。

1. 失敗の原因を直してから、release ワークフローをもう一度実行する。`changeset publish` は、同じ版が npm にあるパッケージを飛ばし、残りだけを公開する
2. 1 回目に公開したパッケージのタグがないときは、main で `pnpm changeset tag` を実行してタグを作り、`git push --follow-tags` で push する

### 壊れた版を公開したとき

npm では、一度使った版の番号は、unpublish したあとも二度と使えない。unpublish にも期限などの条件がある。そのため、壊れた版は unpublish しない。

1. `npm deprecate <パッケージ>@<版> "<理由>"` で、その版を使わないよう示す
2. 直した版を、changeset を足した patch の版として公開する

### 公開のあとに確かめること

- 5 つのパッケージがすべて npm にあり、`npm view <パッケージ> dist-tags` の `latest` が公開した版になっている
- 新しいプロジェクトで `npx loomake@latest --version` と `npx loomake init` が動く
- Node 22.12 でも `npx loomake@<公開した版> --version` が動く
- npm のページに README が出て、リンクが開ける
- 2 回目以降は、npm のページに provenance が出る（リポジトリが public のとき）

## やった方がいいこと

- **GitHub の environment で公開に承認を求める**：リポジトリを public にしたら、`npm` などの environment を作って公開のジョブに付け、承認する人を決める。Trusted Publisher にも、その environment の名前を登録する。public のリポジトリでは無料で使え、main を保護できない問題のうち、公開の部分を補える
- **pack して動かす CI**：「pack → 新しいプロジェクトに入れる → `init`・`verify`・`doctor` を実行」をジョブにする。手で行っている確認を自動にでき、`files` の漏れ（templates・schema）を公開前に見つけられる。publint も足す
- **型の解決を確かめる**：`@arethetypeswrong/cli` は道具のエラーで実行できず、型の解決はまだ確かめていない
- **`@loomake/source` 条件**：各パッケージの `exports` にあるこの条件は、tarball に入っていない `./src/index.ts` を指す。利用者がこの条件を有効にしなければ影響はないが、公開する package.json から外す方法を検討する
- **ビルド前に `dist/` を消す**：ソースを消したとき、古い `dist/` のファイルが手元のビルドに残る。release ワークフローはまっさらな状態でビルドするので、公開物には影響しない
- **非公開の脆弱性の報告を有効にする**：リポジトリを public にしたら、Settings の「Code security」で private vulnerability reporting を有効にする。[SECURITY.md](../SECURITY.md) は、この方法で報告を受け付けると書いている
- **古いブランチの片づけ**：古い main がもとのブランチ `prepare-npm-publish` は、`prepare-npm-publish-2` に置き換えた。ほかのセッションのワークツリーで使われているので、そのセッションの作業が終わってから消す
- **任意**：GitHub の Releases のページを作る。CHANGELOG はパッケージに入るが、Releases のページはできない。`changesets/action` を使うか、タグから Release を作るステップを足す
- **任意**：`declarationMap` と `sourceMap` を出すと、利用者が型定義から元のコードへ飛べる
