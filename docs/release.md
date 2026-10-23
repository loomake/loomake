# npm 公開前の確認結果

2026-10-23 時点の HEAD（`85c21a0`）で確かめた結果をまとめる。2026-10-23 の初回調査と 2026-10-24 の再レビューで分かったことも、この文書に取り込んだ。

## 確かめたこと

- 5 つのパッケージをビルドして `pnpm pack` し、git だけを初期化した新しいプロジェクトに入れた。`loomake --version`・`--help`・`init`・`verify`・`doctor`・`run --help` は期待どおりに動いた
  - `init` は AGENTS.md・CLAUDE.md・loomake.config.json・Skill・`.gitignore` の行を置き、openspec init とテストレポートの設定を案内した
  - `verify` は lint・typecheck・test のスクリプトがないため不合格（終了コード 1）になった。これは想定どおり
  - `doctor` は openspec/ がないことを問題として示し、終了コード 1 を返した
- tarball では `workspace:*` が具体的な版（今は `0.0.0`）に置き換わる
- 収録物は次のとおり。`kit` の `templates/` は元のファイルと一致し、`dist/` に古いビルドの残りはなかった
  - 全パッケージ：`LICENSE`・`dist/`・`package.json`
  - core：`schema/` も含む
  - kit：`templates/` も含む
- npm で `loomake`・`@loomake/core`・`@loomake/trace` を引くと 404 が返る。ただし、これは名前を予約したことにも、公開できることの保証にもならない

公開を止めるほどの不具合は見つからなかった。ただし、次の項目は公開前に片づけておきたい。

## 公開前に直すべきこと

### 1. package.json のメタデータが足りない

- 5 つとも `repository`・`homepage`・`bugs` がない。npm のページにリポジトリへのリンクが出ない
- provenance つきで公開すると、`repository` が GitHub のリポジトリ（`https://github.com/loomake/loomake`）と一致しない場合に失敗する。`repository.directory` も書く
- `loomake` の `description` は「CLI（init・verify）」のままで、trace・run・doctor が抜けている。core・kit・trace・runner には `description` 自体がない
- 検索用の `keywords`（openspec、ai-agent、requirements-traceability など）も入れる

### 2. パッケージに README が入っていない

- tarball に README がないため、npm のページが空になる
- `loomake` には短い README を入れる。何をするか、`npx loomake init` から始める手順、docs へのリンク、実行時に要る外部コマンド（`openspec`・`gh`・`claude`）を書く
- core・kit・trace・runner は「loomake の内部用。直接の利用はサポートしない」と書くだけで足りる（6 を参照）

### 3. release ワークフローが品質コマンドを実行しない

`.github/workflows/release.yml` は、ビルドが通れば公開まで進む。

- 公開の前に `pnpm lint`・`pnpm typecheck`・`pnpm test` を実行する。少なくとも、公開するコミットで CI が成功していることを確かめる
- `concurrency` を設定し、公開が二重に走らないようにする

### 4. 初回公開と、継続公開の認証を分ける

npm の Trusted Publishing（OIDC）で公開すれば、トークンの管理が要らない。ただし、まだ存在しないパッケージには Trusted Publisher を登録できない。そこで、初回だけ `NPM_TOKEN` で公開し、そのあと OIDC に切り替える。release ワークフローは両方に対応している（prepare-npm-publish の REQ-141）。

初回の公開：

1. npm で `@loomake` organization を作り、公開権限を持つメンバーを決める。あわせて、`loomake` の名前で公開できるか確かめる（似た名前のパッケージがあると拒否されることがある）
2. 公開の権限がある有効期限の短いトークンを作り、GitHub の secrets に `NPM_TOKEN` として登録する
3. GitHub 上から release ワークフローを main で実行する。手元からは公開しない。品質コマンドと、公開するコミットの確認を通らないため

2 回目以降の公開：

1. npm で 5 つのパッケージそれぞれに Trusted Publisher を登録する（リポジトリ `loomake/loomake`、ワークフロー `release.yml`）
2. GitHub の secrets から `NPM_TOKEN` を外し、npm でもトークンを無効にする。secret がなければ `NODE_AUTH_TOKEN` は空になり、npm は OIDC で認証する
3. 次の公開で、OIDC で公開できたかを確かめる。`changeset publish` は pnpm のワークスペースでは `pnpm publish` を呼ぶが、pnpm（12.10.1）が OIDC での公開に対応しているかは未確認。できなければ change を作り、公開の方法を `npm publish` に替える

あわせて、次の点に注意する。

- Trusted Publishing には npm 11.5.1 以上と Node 22.14.0 以上が要る。release ワークフローは Node 24 を使い、npm を 11.19.0 に固定して入れる
- provenance を自動で付けるには、リポジトリが公開されている必要がある。GitHub のリポジトリはいま private で、このままでは README と `homepage` のリンクも npm の利用者には開けない。公開前に public にするかは未回答（prepare-npm-publish の Q-01）

参考：[Changesets の公開手順](https://github.com/changesets/changesets/blob/main/site/guide/versioning-and-publishing.md)、[npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers/)

## 判断が要ること

### 5. 未消化の changeset が 23 個ある

- このまま `pnpm changeset version` を実行すると、5 つとも 0.1.0 になる。ただし、最初の CHANGELOG が開発途中の細かい記録の羅列になる
- おすすめは初回公開の前に「初版」1 つにまとめること
- 5 つの版をそろえる `fixed` は、REQ-056（パッケージごとに独立した版で公開）とぶつかる。採用するなら仕様の変更が要る。内部の依存は具体的な版で固定されるため、版が独立していても組み合わせは決まる。おすすめは独立した版のまま、後述の「pack して動かす CI」で組み合わせを確かめること

### 6. 内部パッケージの API をどこまで支えるか

- 0.y.z のあいだは SemVer の上でも API を安定と扱わない。ただし、公開すれば誰でも core・kit・trace・runner を直接 import できる
- おすすめはサポートするのは CLI（と `@loomake/core` の JSON スキーマ）だけ、と README に明記すること
- 各パッケージの `exports` にある `@loomake/source` の条件は、tarball に入っていない `./src/index.ts` を指す。利用者がこの条件を有効にしなければ影響はないが、公開する `package.json` から外す方法も検討する

参考：[SemVer](https://semver.org/spec/v2.0.0.html)

### 7. Node 20 のサポートを続けるか

- Node 20 のサポートは 2026-04 に終わっている。`engines: >=20.19.0`（REQ-048）を `>=22` に上げるかを決める
- 実行時の依存は Loomake のパッケージだけなので、技術的には 20 でも動く（CI の `node20` ジョブで確かめている）。ESLint や Vitest が 22 以上を求めるのは開発時の事情で、配布物の制約ではない
- おすすめはサポート終了を理由に `>=22` へ上げること。上げれば CI の `node20` ジョブを外せる。要件の変更なので change 経由になる

## やった方がいいこと

- **pack して動かす CI**：「pack → 新しいプロジェクトに入れる → `init`・`verify`・`doctor` を実行」をジョブにする。今回手で行った確認を自動にでき、`files` の漏れ（templates・schema）を公開前に見つけられる。`publint` と `@arethetypeswrong/cli` も手軽に足せる
- **ビルド前に `dist/` を消す**：今は古いファイルが残らないが、ソースを消したときに古い `dist/` のファイルが手元からの公開に混ざりうる。release ワークフローはまっさらな状態でビルドするので影響しない
- **セキュリティの案内**：`loomake run --skip-permissions` の注意（`LOOMAKE_SANDBOX=1` と通信の制限）を、パッケージの README にも 1 行入れる
- **`SECURITY.md`**：脆弱性の報告先を決めておく
- **任意**：`declarationMap` と `sourceMap` を出すと、利用者が型定義から元のコードへ飛べる

## 公開の直前に確かめること

- 公開するコミットがきれいな main であること。今の作業ツリーには未コミットの変更（README・docs など）がある。公開は手元からではなく、ワークフローで行う（初回の手動公開を除く）
- changeset がすべて消化されていること。release ワークフローは、残っていれば止まる
- `loomake` の名前と `@loomake` organization を確保し、公開権限があること

## 進め方の案

1. 1〜3 を 1 つの change にまとめる（メタデータ・README・release ワークフローでの品質コマンドの実行）。仕様にない振る舞いを足すものではないが、release ワークフローの変更は monorepo の仕様に関わるか確かめる
2. 5〜7 は判断をもらってから、必要なものをそれぞれ change にする
3. 4 の手順で初回を公開し、Trusted Publishing に切り替える
4. 公開後、`npx loomake@latest --version` と、新しいプロジェクトでの `init` を確かめる
