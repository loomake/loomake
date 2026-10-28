# monorepo Specification

## Purpose
Loomake の core・kit・trace・runner・CLI を、1 つの pnpm workspaces のモノレポで開発するための構成を定める。開発環境（devcontainer）、Node.js のバージョン、3 つの OS での CI とプルリクエストごとの完了ゲート、changesets による公開の準備、ライセンスを含む。

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
ルートと各パッケージの `package.json` は、`engines.node` に `>=22.12.0` を宣言する SHALL。CI は、Node 22.12.0 でビルドした CLI が動くかを確かめる MUST。

Source: REQ-142

#### Scenario: engines が宣言されている
- **WHEN** ルートと `packages/core`・`packages/kit`・`packages/trace`・`packages/runner`・`packages/cli` の `package.json` を読む
- **THEN** すべての `engines.node` が `>=22.12.0` である

#### Scenario: CI が下限の版で CLI を動かす
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** Node 22.12.0 で `packages/cli/dist/cli.js` を実行するジョブがある

### Requirement: 3 つの OS での CI
CI の quality ジョブは、main への push と、毎日 1 回の定期実行（schedule）では、ubuntu-latest・macos-latest・windows-latest の 3 つで実行し、`pnpm test` を実行する SHALL。pull_request では、quality ジョブを ubuntu-latest だけで実行する SHALL。ただし、PR に `ci:all-os` ラベルが付いているときは、pull_request でも 3 つの OS で実行する SHALL。PR にラベルを付けたとき（labeled）にも、CI を起動する MUST。node20・node22・gate のジョブは、この OS の切り替えの影響を受けない MUST。「文書だけの PR の品質ジョブ」に当てはまる PR では、quality ジョブで `pnpm test` を実行しなくてよい。

Source: REQ-049, REQ-270, REQ-273

#### Scenario: ワークフローが 3 OS を指定している
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** quality ジョブのマトリクスの OS を決める式に、ubuntu-latest・macos-latest・windows-latest が含まれる

#### Scenario: ラベルのない PR は ubuntu だけで実行する
- **WHEN** `ci:all-os` ラベルのない PR で CI が動く
- **THEN** quality ジョブは ubuntu-latest の 1 つだけで動き、lint・typecheck・`pnpm test --coverage`・build・配布物の検査を実行する。macos-latest と windows-latest の quality ジョブは動かない

#### Scenario: main への push と定期実行は 3 つの OS で実行する
- **WHEN** main への push か、毎日 1 回の定期実行（schedule）で CI が動く
- **THEN** quality ジョブは ubuntu-latest・macos-latest・windows-latest の 3 つで動き、macOS と Windows ではシャード `1/2` と `2/2` で `pnpm test` を実行する

#### Scenario: ci:all-os ラベルの付いた PR は 3 つの OS で実行する
- **WHEN** `ci:all-os` ラベルの付いた PR で CI が動く
- **THEN** quality ジョブは main への push と同じく、ubuntu-latest・macos-latest・windows-latest の 3 つで動く

#### Scenario: ラベルを付けると CI が起動する
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** pull_request の起動の種類に、既定の opened・synchronize・reopened に加えて labeled があり、schedule に 1 日 1 回の cron がある

#### Scenario: ほかのジョブは OS の切り替えの影響を受けない
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** node20・node22・gate のジョブは ubuntu-latest で動き、OS を切り替える式を使わない。gate は今までどおり pull_request のときだけ動く

### Requirement: プルリクエストごとの完了ゲート
CI はプルリクエストごとに完了ゲートを実行し、不合格のときジョブを失敗させる SHALL。対象の change は「完了ゲートの対象の決め方」に従って決め、対象の change ごとに `--change <id> --done` で実行し、1 つでも不合格ならジョブを失敗させる MUST。対象の change がないときは、「対象の change がない PR の扱い」に従う MUST。あわせて、PR の種類によらず、いまの仕様（`openspec/specs/`）に `openspec validate --specs --strict` を実行し、失敗したらジョブを失敗させる SHALL。

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

#### Scenario: いまの仕様の検証
- **WHEN** archive で反映した Requirement の本文が長すぎて、`openspec validate --specs --strict` が失敗する PR で CI が動く
- **THEN** gate ジョブが失敗する

### Requirement: changesets による公開準備
リポジトリは changesets を設定し、パッケージごとに独立したバージョンで公開できる状態にする SHALL。`pnpm changeset status` がエラーなく終わる SHALL。ただし、main と比べて変えたファイルが、`pnpm changeset version` による版の上げ下げ（各 package.json の `version` と内部の依存の版、CHANGELOG.md、消化して消した `.changeset/*.md`）だけのときは、`changeset status` の失敗を許す SHALL。

Source: REQ-056

#### Scenario: changesets が設定されている
- **WHEN** `.changeset/config.json` を読む
- **THEN** ファイルが存在し、`pnpm changeset status` がエラーなく終わる

#### Scenario: 版を上げるだけの変更
- **WHEN** main と比べて、package.json の version・CHANGELOG.md・消した changeset だけが変わっている
- **THEN** 公開準備の検査は合格する

#### Scenario: 版の上げ下げ以外の変更
- **WHEN** main と比べて、package.json の version のほかに scripts も変わっていて、changeset がない
- **THEN** 公開準備の検査は不合格になる

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

### Requirement: 配布物からの主要コマンドの検証
5パッケージのtarballを別プロジェクトへオフラインで導入し、公開APIとJSONスキーマ、help・version・init・doctor・verifyの仕様と完了ゲート・trace recordとreportを検証する SHALL。失敗時は終了コード0を返さない SHALL。

Source: REQ-143

#### Scenario: 配布物を検証する
- **WHEN** ビルドした5パッケージをpackして検証する
- **THEN** ワークスペースのsrcに依存せず主要コマンドが成功する

### Requirement: 対応環境での配布物の検証
CIは3OSのNode24で配布物の主要コマンドを検証し、過去の下限Node20.19.0でも追加で確認する SHALL。配布物の宣言する下限Node22.12.0での確認は「Node.js のバージョン宣言」に従う。開発ツールを使う準備はNode24で行い、ランタイムの確認は指定したNodeで行う SHALL。

Source: REQ-144

#### Scenario: Node下限で検査する
- **WHEN** Node24で準備した配布物を、過去の下限Node20.19.0で使う
- **THEN** 開発ツールを実行せず主要コマンドの動作を確認する

### Requirement: 公開対象コミットの品質ゲート
公開ワークフローは、公開対象のコミットでlint・型検査・テスト・ビルドと配布物の検証を行い、いずれかが失敗すると公開しない SHALL。認証情報は公開を行うステップに限定する SHALL。

Source: REQ-145

#### Scenario: 検査に失敗する
- **WHEN** 公開対象コミットの品質検査か配布物の検査が失敗する
- **THEN** publishのステップに進まない

### Requirement: 公開するexportsの参照先
公開するパッケージのexportsは、tarballにあるファイルを参照する SHALL。開発時の@loomake/source条件は公開するexportsに含めない SHALL。ワークスペースでのソース参照は維持する SHALL。

Source: REQ-146

#### Scenario: 公開物と開発環境を分ける
- **WHEN** ワークスペースとpackしたパッケージを読む
- **THEN** 開発環境ではソースを参照でき、公開物は同梱したdistとschemaを参照する

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

### Requirement: kit の中の依存の向き
`@loomake/kit` の実行の基盤（外部プロセスの監視・入力の上限・エラーの型など）は `packages/kit/src/runtime/` に置き、`node:` のモジュール・`@loomake/core`・`yaml`・`runtime/` の中のファイルだけを import する SHALL。機能（`verify/`・`init/`・`doctor/`）は、自分のディレクトリ・`runtime/`・設定の読み込み（`verify/config.ts`）だけを import し、ほかの機能を import しない SHALL。kit の外部のパッケージとして import してよいのは、`node:` のモジュール・`@loomake/core`・`yaml` だけとする SHALL。`@loomake/kit`（自分の公開の入口）やほかのパッケージを経由して import しない MUST。

Source: REQ-207

#### Scenario: 基盤が機能を import しない
- **WHEN** `packages/kit/src/runtime/` のファイルの import を読む
- **THEN** `node:`・`@loomake/core`・`yaml`・`runtime/` の中のファイルだけを import している

#### Scenario: 機能どうしが import しない
- **WHEN** `packages/kit/src/init/` と `packages/kit/src/doctor/` のファイルの import を読む
- **THEN** ほかの機能のディレクトリは、設定の読み込み（`verify/config.ts`）だけを import している

#### Scenario: yaml の import を認める
- **WHEN** 依存の向きの検査に、`runtime/` または機能のディレクトリのファイルが `yaml` を import する文を渡す
- **THEN** 検査はその import を決まりに反するものとして返さない

#### Scenario: これまでの禁止の例を引き続き拒否する
- **WHEN** 依存の向きの検査に、`runtime/` から機能への import、機能から別の機能への import（設定の読み込みの `verify/config.ts` を除く）、`@loomake/kit` やほかのパッケージ（`@loomake/trace` など）の import を渡す
- **THEN** 検査はどれも決まりに反する import として返す

### Requirement: CI のテストの分割
CI の quality ジョブは、macOS と Windows では `pnpm test` を `--shard` で 2 つのシャードに分け、別々のジョブで実行する SHALL。2 つのシャードを合わせて、すべてのテストを実行する MUST。ubuntu では `pnpm test` を 1 回だけ、カバレッジ付き（`--coverage`）で実行し、カバレッジが閾値を下回ったらジョブを失敗させる SHALL。どのジョブでも、lint・typecheck・build・配布物の検査を実行する MUST。ただし、「文書だけの PR の品質ジョブ」に当てはまる PR では、これらのステップを実行しなくてよい。

Source: REQ-214, REQ-270

#### Scenario: macOS と Windows のシャード
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** quality ジョブのマトリクスで、macos-latest と windows-latest のそれぞれにシャード `1/2` と `2/2` があり、`pnpm test --shard=` にシャードを渡すステップがある

#### Scenario: ubuntu ではカバレッジ付きで 1 回だけ実行する
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** ubuntu-latest にはシャードがなく、`pnpm test --coverage` のステップがあり、ほかにすべてのテストを実行するステップ（`pnpm test:coverage` など）はない

### Requirement: PR の古い CI 実行の取り消し
CI のワークフローは、同じ PR に新しい push があれば、その PR の古い実行を取り消す SHALL。main への push で動いた実行は取り消さない MUST。

Source: REQ-215

#### Scenario: PR の古い実行を取り消す
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** ワークフローの `concurrency` の group に PR の番号が入り、`cancel-in-progress` は `github.event_name == 'pull_request'` のときだけ true になる

#### Scenario: main への push の実行は取り消さない
- **WHEN** `.github/workflows/ci.yml` を読み、main への push で続けて動く実行の `concurrency` の group を求める
- **THEN** group には `github.run_id` が入り、実行ごとに分かれる。`cancel-in-progress` は false になる。待機中の実行が、同じ group の次の push の実行に置き換えられて取り消されることはない

### Requirement: OS によらないテストの前提
リポジトリのテストとテスト用のスクリプトは、ubuntu-latest・macos-latest・windows-latest で同じ期待値を使う SHALL。OS の違いは期待値を変えず、skip もせずに、テストの準備と読み方で吸収する MUST。行の正規表現で読むファイルは、改行を LF にそろえてから読む MUST。リンク先のないシンボリックリンクを `.git/hooks` に置くときは、git がフックとして実行しない名前にする MUST。Windows でシェルから起動するとき、固定の裸のコマンド名 `pnpm`・`npm` は引用符で囲まず、空白を含みうる実行パスと引数は囲む MUST。準備の時間が OS で変わる非同期の待ちには、待ち時間を明示する MUST。

Source: REQ-236

#### Scenario: CRLF で取り出したワークフロー
- **WHEN** Windows でワークフローの YAML が CRLF で取り出され、公開経路の権限と CodeQL のワークフローの検査を実行する
- **THEN** 改行を LF にそろえてから読み、LF のときと同じ期待値で検査する

#### Scenario: リンク先のないリンクを置いたフックのディレクトリ
- **WHEN** リンク先のないシンボリックリンクを `.git/hooks` に置いて、テストの準備のコミットをする
- **THEN** git はそのリンクを実行せず、run の git の設定とフックの比較まで進む

#### Scenario: 配布物の準備のコマンド
- **WHEN** Windows で配布物の試験のスクリプトが `pnpm` か `npm` を起動する
- **THEN** コマンド名を引用符で囲まずに起動し、引数と、`.cmd` で終わる実行パスは引用符で囲む

#### Scenario: 二重起動の待ち
- **WHEN** Windows で run の開始からエンジンの起動までに 1 秒以上かかる
- **THEN** 二重起動の検査は明示した待ち時間のうちに先の実行のエンジンの起動を待ってから、二重起動を試す

### Requirement: 外部操作の期限の試験の偽の CLI
外部操作の期限を確かめる試験は、ubuntu-latest・macos-latest・windows-latest のどれでも、偽の CLI（git・gh・OpenSpec CLI）を製品と同じ起動の仕方で呼ばせる SHALL。git は shell なしで、gh と OpenSpec CLI は Windows では shell 経由で起動する。試験は、偽の CLI が狙った操作で止まった印と、それより前の本物への転送が起動に失敗していないことを確かめてから、期限・終了コード・停止の理由・後続の処理を確かめる SHALL。予算を延ばした試験は、1 操作の期限または共有予算より長く待ったことと、期限に猶予を足した時間のうちに止まったことを確かめる SHALL。

Source: REQ-240

#### Scenario: 偽の git が呼ばれない
- **WHEN** 偽の git が呼ばれず、本物の git が動く
- **THEN** 試験は狙った段階に届いていないとして失敗し、期限と終了コードだけで合格にしない

#### Scenario: 準備で予算を使い切る
- **WHEN** 準備の外部操作だけで共有予算を使い切り、狙った操作に届かない
- **THEN** 試験は合格しない

### Requirement: 文書だけの PR の品質ジョブ
CI の quality ジョブは、PR で変えたファイルがすべて「文書として扱うファイル」に当たるとき、lint・typecheck・test・build・配布物の検査を実行せずに成功する SHALL。判定はジョブの中のステップで行い、ワークフローの `paths`・`paths-ignore` やジョブの `if` では行わない MUST（必須チェックのジョブが、同じ名前で結果を報告するようにするため）。main への push では、判定によらず、すべてのステップを実行する MUST。

Source: REQ-270

#### Scenario: 文書だけの PR
- **WHEN** PR で変えたファイルが `docs/worklog/2026-10-27.md`・`openspec/changes/c1/tasks.md`・`.changeset/c1.md` だけである
- **THEN** 判定は「文書だけ」になり、quality ジョブは lint・typecheck・test・build・配布物の検査を実行せずに成功する

#### Scenario: 判定をジョブの中で行う
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** ワークフローの `on` に `paths`・`paths-ignore` がなく、quality ジョブに変えたファイルを判定するステップがあり、lint・typecheck・test・build・配布物の検査のステップは、判定が「文書だけ」でないときだけ実行される

#### Scenario: main への push
- **WHEN** main への push で quality ジョブが動く
- **THEN** 変えたファイルによらず、すべてのステップを実行する

### Requirement: 文書として扱うファイル
「文書だけの PR の品質ジョブ」の判定で文書として扱うのは、次のファイルだけとする MUST。

- リポジトリの直下にある `.md` のファイル（`README.md`・`CONTRIBUTING.md` など）
- `docs/` の下にある `.md` のファイル
- `openspec/specs/` と `openspec/changes/`（`archive/` を含む）の下にある `.md` のファイルと、`openspec/changes/` の下にある `spec-gate.txt`
- `.changeset/` の直下にある `.md` のファイル（changeset の本文）

これ以外のファイル（設定・実行用のファイル・`tests/` の下・`packages/` の下のファイルを含む）は、文書として扱わない MUST。

Source: REQ-270

#### Scenario: コードを含む PR
- **WHEN** PR で変えたファイルに `packages/kit/src/verify/run.ts` が含まれる
- **THEN** 判定は「文書だけ」にならず、quality ジョブはすべてのステップを実行する

#### Scenario: 配布する Markdown を含む PR
- **WHEN** PR で変えたファイルが `packages/kit/templates/AGENTS.md` だけである
- **THEN** 判定は「文書だけ」にならず、quality ジョブはすべてのステップを実行する

#### Scenario: 設定と実行用のファイルを含む PR
- **WHEN** PR で変えたファイルが、`.changeset/config.json`・`openspec/config.yaml`・`docs/wbs/initial-status.yaml`・`scripts/ci-gate.mjs` のどれか 1 つと、`docs/` の下の `.md` だけである
- **THEN** どの場合も、判定は「文書だけ」にならず、quality ジョブはすべてのステップを実行する

#### Scenario: 試験用データを含む PR
- **WHEN** PR で変えたファイルが `tests/fixtures/verify-project/openspec/changes/sample/tasks.md` だけである
- **THEN** 判定は「文書だけ」にならず、quality ジョブはすべてのステップを実行する

#### Scenario: 判定のスクリプトとワークフローを変えた PR
- **WHEN** PR で変えたファイルが、`scripts/ci-docs-only.mjs` か `.github/workflows/ci.yml` と、`docs/` の下の `.md` だけである
- **THEN** 判定のスクリプトとワークフローは文書ではないので、PR に入っている版のスクリプトで判定しても「文書だけ」にならず、quality ジョブはすべてのステップを実行する

#### Scenario: 文書の置き場所にある設定と実行用のファイル
- **WHEN** PR で変えたファイルが、`docs/` の下の `.json`・`.yaml`・`.yml`、`.github/` の下の `.md`、`openspec/changes/archive/` の下の `.mjs` のどれか 1 つだけである
- **THEN** どの場合も、判定は「文書だけ」にならない

### Requirement: 文書だけかの判定に使う差分
「文書だけの PR の品質ジョブ」の判定には、PR のベースとの差分（ベースから PR の先頭までのすべてのコミット）で変わったファイルをすべて使う MUST。名前を変えたファイルは、変更前と変更後の両方のパスを判定する MUST。消したファイルも判定する。差分を取れなかったとき、差分を解釈できなかったとき、PR のマージ先が main でないときは、文書だけではないとみなす MUST（マージ先を変えても CI は再実行されないため）。

Source: REQ-270

#### Scenario: 前のコミットでコードを変えた PR
- **WHEN** PR の 1 つ目のコミットで `packages/kit/src/verify/run.ts` を変え、2 つ目のコミットで `docs/notes.md` だけを変えた
- **THEN** 判定はベースとの差分のすべてのファイルを使うので「文書だけ」にならず、quality ジョブはすべてのステップを実行する

#### Scenario: 名前を変えたファイル
- **WHEN** PR で `scripts/notes.md` の名前を `docs/notes.md` に変えた
- **THEN** 変更前のパス `scripts/notes.md` が文書ではないので、判定は「文書だけ」にならない

#### Scenario: 差分を取れない、または解釈できない
- **WHEN** PR のベースとの差分を取るコマンドが失敗する、または差分の出力に解釈できない行がある
- **THEN** 判定は「文書だけ」にならず、quality ジョブはすべてのステップを実行する

#### Scenario: マージ先が main でない PR
- **WHEN** マージ先が `feature-x` の PR で、変えたファイルが `docs/notes.md` だけである
- **THEN** 判定は「文書だけ」にならず、quality ジョブはすべてのステップを実行する

#### Scenario: main が進んだあとのマージコミット
- **WHEN** PR を作ったあとで main に `packages/kit/src/a.ts` の変更が入り、判定する HEAD が main と PR のブランチ（`docs/notes.md` だけを変えた）をマージしたコミットである
- **THEN** 判定は `origin/main...HEAD` の差分で PR の変更分だけを使い、main で変わったファイルを含めないので「文書だけ」になる

#### Scenario: コードのファイルを消した PR
- **WHEN** PR で `packages/kit/src/a.ts` を消し、`docs/notes.md` を変えた
- **THEN** 消したファイルも判定するので、判定は「文書だけ」にならない
