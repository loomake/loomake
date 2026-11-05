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
配置先に内容の異なる同名ファイルがある場合、`loomake init` は差分を表示して確認を求め、承諾されない限り既存内容を変えない MUST。ただし `--yes` または `--keep-existing` を指定した場合は確認を求めず、各オプションの方針に従う SHALL。どちらも指定せず、確認を受け付けられない環境（標準入力が TTY でない）で差分がある場合は、どのファイルも配置せずに中止し、両オプションの使い方を日本語で案内して終了コード 1 を返す MUST。置き先がシンボリックリンクを通ってプロジェクトの外を指す場合と、リンク先の無いシンボリックリンクの場合は、オプションの指定によらず既存ファイルを読まず差分も表示せず、何も配置せずに終了コード 1 を返す MUST。

Source: REQ-020, REQ-421

#### Scenario: 同名ファイルがあり、断る
- **WHEN** 内容の異なる `AGENTS.md` がある状態で `loomake init` を実行し、確認で拒否する
- **THEN** 差分が表示され、既存の `AGENTS.md` は変更されない

#### Scenario: 同名ファイルがあり、承諾する
- **WHEN** 内容の異なる `AGENTS.md` がある状態で `loomake init` を実行し、確認で承諾する
- **THEN** `AGENTS.md` がテンプレートの内容に置き換わる

#### Scenario: 確認できない環境
- **WHEN** 標準入力が TTY でない状態で、内容の異なる `AGENTS.md` があるディレクトリで `--yes` と `--keep-existing` を指定せずに `loomake init` を実行する
- **THEN** 差分と `--yes`・`--keep-existing` の使い方が表示され、どのファイルも作成・変更されず、終了コードは 1 である

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
`openspec/` ディレクトリが無い場合、`loomake init` は `openspec init` の実行を案内する SHALL。成功して終了コード0を返すとき、`openspec/` の有無と `--codex` の指定によらず「要件書から change を作るときは req-to-openspec、作成済み change の調査・更新・実装・archive には OpenSpec が配置する openspec-* の Skill を使ってください。」を日本語の1行で1回だけ案内する SHALL。中止して終了コード1を返すときと使い方の誤りで終了コード2を返すときは、この使い分けの案内を出さない MUST。

Source: REQ-023

#### Scenario: openspec/ が無い
- **WHEN** `openspec/` の無いプロジェクトで `loomake init` を実行する
- **THEN** 出力に `openspec init` の実行を促す案内が含まれる

#### Scenario: openspec/ がある
- **WHEN** `openspec/` のあるプロジェクトで `loomake init` を実行する
- **THEN** `openspec init` の案内は出力されない

#### Scenario: 成功時の使い分けの案内
- **WHEN** 何も置かれていないディレクトリで `loomake init` を実行する
- **THEN** 使い分けの案内が1行で1回だけ出て、終了コードは0である

#### Scenario: OpenSpec がある状態で Codex 向けに配置する
- **WHEN** `openspec/` のあるプロジェクトで `loomake init --codex` を実行する
- **THEN** 同じ使い分けの案内が1回だけ出て、`openspec init` の文字列は含まれず、`openspec-*` のSkillは配置しない

#### Scenario: 中止や使い方の誤り
- **WHEN** `--yes` と `--keep-existing` を指定せずに確認できない環境で同名ファイルの差があるか、置き先のリンクが安全でないか、未対応のオプションがある
- **THEN** 使い分けの案内は出ず、終了コードはそれぞれ1・1・2である

### Requirement: パッケージマネージャの判定
`loomake init` は package.json から pnpm・npm・yarn のどれを使っているかを判定し、`loomake.config.json` の `commands` の既定値に反映する SHALL。package.json がないときは、commands を npm の既定値のまま書き、`loomake.config.json` の commands をこのプロジェクトのコマンドに書き換えるよう案内する SHALL。書き換えの案内には「書き換えるまで、loomake doctor は test の script を確かめられず問題として出します」の 1 文を加える SHALL。

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
- **THEN** `commands` が `npm run lint`・`npm run typecheck`・`npm test` になり、出力に loomake.config.json の commands を書き換えるよう促す案内と「書き換えるまで、loomake doctor は test の script を確かめられず問題として出します」の 1 文が含まれる

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

### Requirement: 実在する script に合わせた commands
`loomake init` は、package.json に `scripts` のオブジェクトがあるとき、`commands` には lint・typecheck・test のうち、`scripts` に空でない文字列で定義された名前のコマンドだけを書く SHALL。書かなかった名前があるときは、その名前と、script を足したら `loomake.config.json` の commands にも書くことを日本語で案内する SHALL。package.json がないときと、`scripts` がないときは、これまでどおり 3 つのコマンドを書く SHALL。

Source: REQ-196

#### Scenario: test だけがある
- **WHEN** `scripts` に test だけがある package.json のプロジェクトで `loomake init` を実行する
- **THEN** `commands` は test だけになり、出力に lint と typecheck を書かなかったことの案内が含まれる

#### Scenario: すべてある
- **WHEN** `scripts` に lint・typecheck・test がある package.json のプロジェクトで `loomake init` を実行する
- **THEN** `commands` は 3 つになり、書かなかった名前の案内は出力されない

#### Scenario: scripts がない
- **WHEN** `scripts` のない package.json のプロジェクトで `loomake init` を実行する
- **THEN** `commands` は 3 つになる

### Requirement: 使っているテストランナーの設定例
`loomake init` は、package.json の dependencies か devDependencies に vitest があれば Vitest の設定例だけを、jest があれば Jest の設定例だけを表示する SHALL。両方あれば両方を、どちらもなければこれまでどおり両方を表示する SHALL。

Source: REQ-197

#### Scenario: vitest を使っている
- **WHEN** devDependencies に vitest がある package.json のプロジェクトで `loomake init` を実行する
- **THEN** Vitest の設定例が表示され、Jest の設定例は表示されない

#### Scenario: jest を使っている
- **WHEN** devDependencies に jest がある package.json のプロジェクトで `loomake init` を実行する
- **THEN** Jest の設定例が表示され、Vitest の設定例は表示されない

#### Scenario: どちらもない
- **WHEN** package.json のないプロジェクトで `loomake init` を実行する
- **THEN** Vitest と Jest の両方の設定例が表示される

### Requirement: 品質目標未設定の雛形の配置
`loomake init`はプロジェクト直下にversion 2のスキーマで読める、品質目標未設定の`quality.yaml`を配置し、結果の一覧に含める SHALL。作成・上書きしたときは、完了ゲートの前に案件の品質の対象と合格に必要な証拠を設定するよう日本語で案内する SHALL。品質目標を`loomake.config.json`へ混ぜない MUST。既存ファイルの保護（REQ-020）をこの配置にも適用する MUST。

Source: REQ-396

#### Scenario: 空のプロジェクトに雛形を置く
- **WHEN** 空のディレクトリで`loomake init`を実行する
- **THEN** 既存の配置物と`quality.yaml`が作られ、一覧に「作成：quality.yaml」が含まれ、終了コードは0となる。雛形はversion 2として読め、品質の対象は未設定で、対象・証拠の設定案内が出る

#### Scenario: 雛形だけでは完了ゲートに合格しない
- **WHEN** 有効なchangeと必要な他の条件を満たしたプロジェクトで、雛形の品質の対象を未設定のまま`--done --scope ci`（scope省略時の既定）を実行する
- **THEN** 品質の対象の判定はINSUFFICIENT_EVIDENCEとなり、空対象だけでPASSを返さない

#### Scenario: 既存の雛形を保護する
- **WHEN** 既存の`quality.yaml`が同じ内容、または異なる内容でTTYで拒否・承諾、または非TTYで差分がある状態で、`--yes` と `--keep-existing` を指定せずにinitを実行する
- **THEN** 同内容は無確認で変更せず、拒否は既存内容を残し、承諾時だけ上書きする。非TTYでの差分はどのファイルも配置せず終了コード1となる。対象・証拠の設定案内は作成・上書きした場合だけ出る

#### Scenario: 雛形の置き先が安全でない
- **WHEN** `quality.yaml`が外部を指すリンクまたはリンク先のないリンクである
- **THEN** initはリンク先を読まず差分を表示せず、どのファイルも配置せず終了コード1となる

#### Scenario: 配布物を空のGitリポジトリへ導入する
- **WHEN** tarballからインストールしたCLIで、空のGitリポジトリへinitを実行する
- **THEN** 既存の配置物と`quality.yaml`が一覧に出て終了コード0となる。`--codex`と`--devcontainer`の有無による既存の配置条件は変わらない

### Requirement: 自動実行されない4ジョブの見本の配置
`loomake init`は`.github/loomake/workflow.example.yml`へgate・run・evaluate・proposeのreusable workflow呼出しを示す見本を配置し、結果の一覧に含める SHALL。ジョブ本体を複製せず、呼出し契約・参照先・固定refが未提供であることを明記する MUST。実行されるworkflowとして配置・有効化せず、4ジョブが稼働済みと案内しない MUST。既存ファイルの保護（REQ-020）をこの配置にも適用する MUST。

Source: REQ-397

#### Scenario: 4ジョブの見本を置く
- **WHEN** 空のディレクトリでinitを実行する
- **THEN** 見本と配置一覧にそのパスが含まれ、4ジョブのusesによる呼出しの形と未提供箇所の説明を確認できる。`.github/workflows/`は新設されず、実行の有効化には契約と固定refの確定が必要と分かる

#### Scenario: 既存の見本を保護する
- **WHEN** 既存の見本が同じ内容、または異なる内容でTTYで拒否・承諾、または非TTYで差分がある状態で、`--yes` と `--keep-existing` を指定せずにinitを実行する
- **THEN** 同内容は無確認で変更せず、拒否は既存内容を残し、承諾時だけ上書きする。非TTYでの差分はどのファイルも配置せず終了コード1となる

#### Scenario: 見本の置き先が安全でない
- **WHEN** 見本のファイルまたは途中のディレクトリが外部を指すリンク、またはリンク先のないリンクである
- **THEN** initはリンク先を読まず差分を表示せず、どのファイルも配置せず終了コード1となる。プロジェクト内部を指すディレクトリのリンクは既存の保護条件のまま扱う

### Requirement: 確認せずに配置対象を上書きする
`loomake init --yes` は、TTY の有無によらず確認を求めず、内容の異なる配置対象の同名ファイルをすべてテンプレートで上書きし、不足ファイルを配置する SHALL。同じ内容のファイルは変更しない MUST。差分・配置結果と、作成・上書きしたファイルに応じた既存の案内を出す SHALL。`--keep-existing` と同時に指定した場合は配置先を読み書きせず、使い方の誤りとして終了コード 2 を返す MUST。

Source: REQ-419

#### Scenario: 非 TTY で全件上書きする
- **WHEN** 内容の異なる AGENTS.md と quality.yaml があり、非 TTY で `init --yes --codex --devcontainer` を実行する
- **THEN** 両ファイルはテンプレートになり、Skill と devcontainer を含む不足ファイルが配置され、差分と上書き結果、品質設定の案内が表示され、終了コードは 0 である

#### Scenario: TTY でも確認しない
- **WHEN** 内容の異なる AGENTS.md があり、TTY で `init --yes` を実行する
- **THEN** 確認を求めず上書きし、終了コードは 0 である

#### Scenario: 同じ内容は変更しない
- **WHEN** テンプレートと改行コードだけが異なる AGENTS.md があり `init --yes` を実行する
- **THEN** AGENTS.md は元の改行コードのまま残り、変更なしと表示される

#### Scenario: 両方の方針を指定する
- **WHEN** `init --yes --keep-existing` をいずれの順序でも実行する
- **THEN** 配置先を読み書きせず、同時に指定できない旨と使い方を表示し、終了コードは 2 である

### Requirement: 確認せずに既存の配置対象を残す
`loomake init --keep-existing` は、TTY の有無によらず確認を求めず、既存の配置対象ファイルを保持し、不足ファイルを配置する SHALL。差分と配置結果を表示する SHALL。`.gitignore` には保持した設定の `tests.report` を既存の規則（REQ-133）どおり追記する SHALL。品質雛形・commands の設定案内は、対象を作成・上書きした場合だけ出す SHALL。

Source: REQ-420

#### Scenario: 非 TTY で既存ファイルを残す
- **WHEN** 内容の異なる AGENTS.md と quality.yaml があり、非 TTY で `init --keep-existing --codex --devcontainer` を実行する
- **THEN** 両ファイルの内容は変わらず、Skill と devcontainer を含む不足ファイルが配置され、差分と保持結果が表示され、品質設定の案内は出ず、終了コードは 0 である

#### Scenario: TTY でも確認しない
- **WHEN** 内容の異なる AGENTS.md があり、TTY で `init --keep-existing` を実行する
- **THEN** 確認を求めず保持し、終了コードは 0 である

#### Scenario: 同じ内容は変更しない
- **WHEN** テンプレートと改行コードだけが異なる AGENTS.md があり `init --keep-existing` を実行する
- **THEN** AGENTS.md は元の改行コードのまま残り、変更なしと表示される

#### Scenario: 設定を残したときの後処理
- **WHEN** カスタムの tests.report を指定した設定と品質雛形があり `init --keep-existing` を実行する
- **THEN** 設定と品質雛形は保持され、.gitignore にカスタムの report を追記し、品質雛形・commands を書いた場合だけの案内は出ない
