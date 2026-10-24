# doctor Specification

## Purpose
`loomake doctor` がプロジェクトの導入状態を調べるときの振る舞いを定める。診断の結果と終了コード、調べる項目、ファイルを変えず品質コマンドも実行しないことを含む。

## Requirements

### Requirement: 導入状態の診断
`loomake doctor` は、プロジェクトの導入状態を項目ごとに調べ、合格・注意・問題のどれかを表示する SHALL。注意と問題には、直し方を日本語で表示する SHALL。問題が 1 つでもあれば終了コード 1、なければ 0 を返す SHALL。doctor はファイルを変更せず、品質コマンドも実行せず、ネットワークに接続しない MUST。

Source: REQ-134

#### Scenario: すべて整っている
- **WHEN** initを実行し、gitのリポジトリで、品質コマンドの実行ファイルと対象scriptがあり、openspec・claude・ghのコマンドもあるプロジェクトでdoctorを実行する
- **THEN** すべての項目が合格と表示され、終了コードは0で、診断した範囲と未確認の内容も表示する

#### Scenario: 何も変更しない
- **WHEN** doctorを実行する
- **THEN** プロジェクトのファイルは追加も変更もされない

### Requirement: 診断する項目
`loomake doctor` は次の項目を調べる SHALL。括弧の中は、満たさないときの扱いとする。

- loomake.config.json があり、読めるか（問題）
- AGENTS.md があるか（問題）
- `openspecDir` のディレクトリがあるか（問題）
- test のコマンドが設定されているか（問題）。lint・typecheck のコマンドが設定されているか（注意）
- 設定したコマンドの先頭の実行ファイルが見つかるか（問題）
- git があり、プロジェクトが git のリポジトリの中にあるか（問題）
- `tests.report` のファイルが `.gitignore` で除外されているか（問題）
- `.loomake/evidence/` の下のファイルが除外されていないか（問題）
- openspec コマンドがあるか（`openspecValidate` が true なら問題、`auto` なら注意。false なら調べない）
- claude と gh のコマンドがあるか（注意）

Source: REQ-134

#### Scenario: 設定ファイルがない
- **WHEN** loomake.config.json のないディレクトリで `loomake doctor` を実行する
- **THEN** loomake.config.json がないことと、`loomake init` を実行するよう案内が表示され、終了コードは 1 である

#### Scenario: テストのレポートを除外していない
- **WHEN** `.gitignore` に `.loomake/test-report.json` の行がない git のリポジトリで `loomake doctor` を実行する
- **THEN** テストのレポートが除外されていないことと、`.gitignore` に足す行が表示され、終了コードは 1 である

#### Scenario: 証拠の記録を除外している
- **WHEN** `.gitignore` に `.loomake/` の行がある git のリポジトリで `loomake doctor` を実行する
- **THEN** 証拠の記録をコミットできないことと、除外を外す方法が表示され、終了コードは 1 である

#### Scenario: 品質コマンドの実行ファイルがない
- **WHEN** commands.test が `nothing-command run` のプロジェクトで `loomake doctor` を実行する
- **THEN** `nothing-command` が見つからないことが表示され、終了コードは 1 である

#### Scenario: run に使う CLI がない
- **WHEN** claude と gh のコマンドがない環境で、ほかは整っているプロジェクトで `loomake doctor` を実行する
- **THEN** claude と gh が注意として表示され、終了コードは 0 である

### Requirement: 品質scriptの静的な確認
単純なnpm run・run-scriptとnpm test、pnpm run・run-scriptとpnpm test・lint・typecheckの呼び出しは、ルートのpackage.jsonを予算つきで読み、scriptsに対象の空でない文字列があるか確認する SHALL。ない場合やpackage.jsonの形が不正な場合は問題とし、対象と直し方を示す SHALL。scriptの本文は実行しない MUST。scriptがある場合も、本文の成功や引数の正しさを保証しない SHALL。runの後のscript名は通常の英数字・ハイフン・アンダースコア・ドット・コロンに限り、正規表現の指定やオプションで対象が変わる呼び出しは未対応として扱う SHALL。npm run envの組み込み処理とYarnのrun-script表記も、scriptを推測せず未対応とする SHALL。

Source: REQ-184

#### Scenario: scriptがない
- **WHEN** commands.testがpnpm testで、package.jsonにtestのscriptがない
- **THEN** testの欠落を問題とし、package.jsonのscripts.testと設定の確認を案内する

#### Scenario: scriptの本文がある
- **WHEN** 単純な呼び出しに対応する空でないscriptがある
- **THEN** 存在を合格とし、品質コマンドを実行しない

### Requirement: 解釈範囲と未確認の表示
doctorは単純な引用付きの先頭実行ファイルを扱い、連結・リダイレクト・変数展開・コマンド置換などのシェル構文は推測で解釈しない SHALL。未対応の構文は注意とし、実行ファイル不存在の問題にしない SHALL。Yarnはscriptが存在すれば確認するが、存在しない場合はバイナリやworkspaceの解決があり得るため、script欠落の問題と断定せず注意にする SHALL。出力には静的な確認範囲と、品質コマンドの成功・レポート生成・認証・ネットワーク接続が未確認であることを表示する SHALL。

Source: REQ-185

#### Scenario: シェルで組み立てるコマンド
- **WHEN** commands.testが環境変数や複合コマンドを使う
- **THEN** 解釈できない範囲と手動で確認する方法を注意として示す

#### Scenario: Yarnのscriptがない
- **WHEN** 単純なyarn testまたはyarn run testでルートのscriptがない
- **THEN** 別の解決経路を推測せず、未確認の注意を示す

### Requirement: 実行ファイルと導入パスの種類
PATHとnode_modules/.binから探す対象は通常のファイルかつPOSIXでは実行権限を持つか確かめる SHALL。壊れたリンクやアクセスエラーで診断全体を例外終了しない SHALL。リンクが指す実行可能な通常のファイルは扱う SHALL。AGENTS.mdは通常のファイル、openspecDirはディレクトリであることを確かめ、異なる種類を存在だけで合格にしない SHALL。

Source: REQ-186

#### Scenario: 名前だけの実行ファイル
- **WHEN** PATHに同名のファイルがあるがPOSIXの実行権限がない
- **THEN** 実行ファイルとして合格にしない

#### Scenario: 導入先の種類が違う
- **WHEN** AGENTS.mdがディレクトリ、またはopenspecDirがファイルである
- **THEN** それぞれを問題とし直し方を案内する

### Requirement: Git診断の期限と結果
doctorのGit操作は共通の外部操作境界を使い、診断全体30秒の共有予算と、外側にある短い予算を守る SHALL。期限切れ・出力超過・中断はGit不存在や単なる未除外と混同せず、診断できなかった対象と確認方法を問題として示す SHALL。check-ignoreは終了コード0と1だけを除外・未除外と解釈し、それ以外は診断の失敗とする SHALL。既存のファイル不変更・品質コマンド不実行・ネットワーク不接続と、問題1・問題なし0の終了コードを維持する SHALL。

Source: REQ-187

#### Scenario: 共有予算が切れる
- **WHEN** doctorのGit診断時に残り時間がない
- **THEN** Git状態を確認できない理由を示し、後続のGit操作を実行しない

#### Scenario: Gitの設定が不正
- **WHEN** Git操作が設定エラーなどで通常の判定を返せない
- **THEN** 除外状態を断定せず、Git状態を確認するよう案内する
