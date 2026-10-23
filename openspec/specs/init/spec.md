# init Specification

## Purpose
`loomake init` がプロジェクトに Loomake のファイルを置くときの振る舞いを定める。AGENTS.md・CLAUDE.md・loomake.config.json・req-to-openspec Skill の配置、既存ファイルの保護、Codex 向けの Skill と devcontainer の配置、OpenSpec 初期化の案内、パッケージマネージャの判定、日本語のメッセージを含む。

## Requirements

### Requirement: 基本ファイルの配置
`npx loomake init` は AGENTS.md、CLAUDE.md、loomake.config.json、req-to-openspec Skill（`.claude/skills/req-to-openspec/`）をプロジェクトに配置する SHALL。package.json の dependencies と devDependencies に loomake がないときは、最後に、判定したパッケージマネージャで loomake を開発用の依存に足すコマンドを案内する SHALL。init は package.json を書き換えない MUST。

Source: REQ-019

#### Scenario: 空のプロジェクトで実行する
- **WHEN** 何も置かれていないディレクトリで `loomake init` を実行する
- **THEN** `AGENTS.md`、`CLAUDE.md`、`loomake.config.json`、`.claude/skills/req-to-openspec/SKILL.md` が作られる

#### Scenario: テストのレポートの出力先
- **WHEN** 何も置かれていないディレクトリで `loomake init` を実行する
- **THEN** `loomake.config.json` の `tests.report` が `.loomake/test-report.json` になり、Vitest と Jest でこのファイルに JSON レポートを書き出す設定の例が表示される

#### Scenario: loomake が依存にない
- **WHEN** `packageManager` が `pnpm@9.0.0` で、依存に loomake がない package.json があるプロジェクトで `loomake init` を実行する
- **THEN** 出力に `pnpm add -D loomake` の案内が含まれ、package.json は変更されない

#### Scenario: npm と yarn の案内
- **WHEN** `packageManager` が `npm@10.0.0`、`yarn@4.0.0` の package.json があるプロジェクトで、それぞれ `loomake init` を実行する
- **THEN** 出力にそれぞれ `npm install -D loomake`、`yarn add -D loomake` の案内が含まれる

#### Scenario: loomake が依存にある
- **WHEN** devDependencies に loomake がある package.json のプロジェクトで `loomake init` を実行する
- **THEN** loomake を依存に足す案内は出力されない

### Requirement: 既存ファイルの保護
配置先に同名ファイルがある場合、`loomake init` は上書きせず、差分を表示して確認を求める SHALL。確認で承諾されない限り、既存ファイルの内容は変えない MUST。確認を受け付けられない環境（標準入力が TTY でない）で同名ファイルがある場合は、何も配置せずに中止し、終了コード 1 を返す MUST。置き先がシンボリックリンクを通ってプロジェクトの外を指す場合と、置き先がリンク先の無いシンボリックリンクである場合は、既存ファイルを読まず差分も表示せず、何も配置せずに中止し、終了コード 1 を返す MUST。

Source: REQ-020

#### Scenario: 同名ファイルがあり、断る
- **WHEN** 内容の異なる `AGENTS.md` がある状態で `loomake init` を実行し、確認で拒否する
- **THEN** 差分が表示され、既存の `AGENTS.md` は変更されない

#### Scenario: 同名ファイルがあり、承諾する
- **WHEN** 内容の異なる `AGENTS.md` がある状態で `loomake init` を実行し、確認で承諾する
- **THEN** `AGENTS.md` がテンプレートの内容に置き換わる

#### Scenario: 確認できない環境
- **WHEN** 標準入力が TTY でない状態で、内容の異なる `AGENTS.md` があるディレクトリで `loomake init` を実行する
- **THEN** 差分が表示され、どのファイルも作成・変更されず、終了コードは 1 である

#### Scenario: 内容が同じ
- **WHEN** テンプレートと同じ内容の `AGENTS.md` がある状態で `loomake init` を実行する
- **THEN** 確認は求められず、ファイルは変更されない

#### Scenario: プロジェクトの外を指すリンク
- **WHEN** `AGENTS.md` がプロジェクトの外のファイルを指すシンボリックリンクである状態で `loomake init` を実行する
- **THEN** リンク先の内容は表示されず、どのファイルも作成・変更されず、終了コードは 1 である

#### Scenario: プロジェクトの外を指すディレクトリのリンク
- **WHEN** `.claude` がプロジェクトの外のディレクトリを指すシンボリックリンクである状態で `loomake init` を実行する
- **THEN** リンク先のディレクトリには何も作られず、どのファイルも作成されず、終了コードは 1 である

#### Scenario: リンク先の無いリンク
- **WHEN** `AGENTS.md` が存在しないファイルを指すシンボリックリンクである状態で `loomake init` を実行する
- **THEN** リンク先のファイルは作られず、どのファイルも作成されず、終了コードは 1 である

#### Scenario: プロジェクトの中を指すリンク
- **WHEN** `.claude/skills` がプロジェクトの中の `.agents/skills` を指すシンボリックリンクである状態で `loomake init` を実行する
- **THEN** これまでどおり Skill がリンク先に置かれ、終了コードは 0 である

### Requirement: Codex 向けの Skill 配置
`--codex` を指定すると、`loomake init` は Skill を `.agents/skills/` にも配置する SHALL。

Source: REQ-021

#### Scenario: --codex を指定する
- **WHEN** `loomake init --codex` を実行する
- **THEN** `.claude/skills/req-to-openspec/` と `.agents/skills/req-to-openspec/` の両方に Skill が置かれる

#### Scenario: --codex を指定しない
- **WHEN** `loomake init` を実行する
- **THEN** `.agents/skills/` は作られない

### Requirement: devcontainer の配置
`--devcontainer` を指定すると、`loomake init` は `.devcontainer/devcontainer.json` を配置する SHALL。

Source: REQ-022

#### Scenario: --devcontainer を指定する
- **WHEN** `loomake init --devcontainer` を実行する
- **THEN** `.devcontainer/devcontainer.json` が作られる

#### Scenario: --devcontainer を指定しない
- **WHEN** `loomake init` を実行する
- **THEN** `.devcontainer/` は作られない

### Requirement: OpenSpec 初期化の案内
`openspec/` ディレクトリが無い場合、`loomake init` は `openspec init` の実行を案内する SHALL。

Source: REQ-023

#### Scenario: openspec/ が無い
- **WHEN** `openspec/` の無いプロジェクトで `loomake init` を実行する
- **THEN** 出力に `openspec init` の実行を促す案内が含まれる

#### Scenario: openspec/ がある
- **WHEN** `openspec/` のあるプロジェクトで `loomake init` を実行する
- **THEN** `openspec init` の案内は出力されない

### Requirement: パッケージマネージャの判定
`loomake init` は package.json から pnpm・npm・yarn のどれを使っているかを判定し、`loomake.config.json` の `commands` の既定値に反映する SHALL。package.json がないときは、commands を npm の既定値のまま書き、`loomake.config.json` の commands をこのプロジェクトのコマンドに書き換えるよう案内する SHALL。

Source: REQ-024

#### Scenario: pnpm のプロジェクト
- **WHEN** `packageManager` が `pnpm@9.0.0` の package.json があるプロジェクトで `loomake init` を実行する
- **THEN** `loomake.config.json` の `commands` が `pnpm lint`・`pnpm typecheck`・`pnpm test` になる

#### Scenario: npm のプロジェクト
- **WHEN** `packageManager` が `npm@10.0.0` の package.json があるプロジェクトで `loomake init` を実行する
- **THEN** `commands` が `npm run lint`・`npm run typecheck`・`npm test` になる

#### Scenario: yarn のプロジェクト
- **WHEN** `packageManager` が `yarn@4.0.0` の package.json があるプロジェクトで `loomake init` を実行する
- **THEN** `commands` が `yarn lint`・`yarn typecheck`・`yarn test` になる

#### Scenario: package.json がない
- **WHEN** package.json のないプロジェクトで `loomake init` を実行する
- **THEN** `commands` が `npm run lint`・`npm run typecheck`・`npm test` になり、出力に loomake.config.json の commands を書き換えるよう促す案内が含まれる

#### Scenario: package.json がある
- **WHEN** package.json があるプロジェクトで `loomake init` を実行する
- **THEN** commands を書き換えるよう促す案内は出力されない

### Requirement: 日本語のメッセージ
`loomake init` のメッセージは日本語である SHALL。

Source: REQ-055

#### Scenario: 日本語の出力
- **WHEN** `loomake init` を実行する
- **THEN** 配置したファイルの一覧と案内が日本語で出力される

### Requirement: Git の除外設定
`loomake init` は、`.gitignore` に、loomake.config.json の `tests.report`（既定は `.loomake/test-report.json`）の行を足す SHALL。`.gitignore` がなければ作り、あれば既存の行を変えずに末尾に足す SHALL。同じ行がすでにあれば足さない SHALL。証拠の記録の置き場（`.loomake/evidence/`）を除外する行は足さない MUST。足したかどうかは、init の結果に表示する SHALL。

Source: REQ-133

#### Scenario: .gitignore がない
- **WHEN** `.gitignore` のないディレクトリで `loomake init` を実行する
- **THEN** `.gitignore` が作られ、`.loomake/test-report.json` の行が入り、結果に `.gitignore` の作成が表示される

#### Scenario: 既存の .gitignore に足す
- **WHEN** `node_modules/` の行だけの `.gitignore` があるディレクトリで `loomake init` を実行する
- **THEN** `.gitignore` は `node_modules/` の行を残したまま、末尾に `.loomake/test-report.json` の行が足される

#### Scenario: すでに除外している
- **WHEN** `.loomake/test-report.json` の行がある `.gitignore` があるディレクトリで `loomake init` を実行する
- **THEN** `.gitignore` は変わらない

#### Scenario: 証拠はコミットできる
- **WHEN** git のリポジトリで `loomake init` を実行する
- **THEN** `.loomake/evidence/c1/x.json` は `.gitignore` で除外されない
