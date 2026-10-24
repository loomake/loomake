# doctor Specification

## Purpose
`loomake doctor` がプロジェクトの導入状態を調べるときの振る舞いを定める。診断の結果と終了コード、調べる項目、ファイルを変えず品質コマンドも実行しないことを含む。

## Requirements

### Requirement: 導入状態の診断
`loomake doctor` は、プロジェクトの導入状態を項目ごとに調べ、合格・注意・問題のどれかを表示する SHALL。注意と問題には、直し方を日本語で表示する SHALL。問題が 1 つでもあれば終了コード 1、なければ 0 を返す SHALL。doctor はファイルを変更せず、品質コマンドも実行せず、ネットワークに接続しない MUST。

Source: REQ-134

#### Scenario: すべて整っている
- **WHEN** init を実行し、git のリポジトリで、test のコマンドの実行ファイルがあり、openspec・claude・gh のコマンドがあるプロジェクトで `loomake doctor` を実行する
- **THEN** すべての項目が合格と表示され、終了コードは 0 である

#### Scenario: 何も変更しない
- **WHEN** `loomake doctor` を実行する
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

### Requirement: 設定の知らないキーの診断
`loomake doctor` は、loomake.config.json に知らないキーがあれば、そのキーを注意として表示し、キーを直すよう案内する SHALL。

Source: REQ-134

#### Scenario: 設定に知らないキーがある
- **WHEN** loomake.config.json に `tests.reprot` のキーがある、ほかは整っているプロジェクトで `loomake doctor` を実行する
- **THEN** `tests.reprot` が知らないキーとして注意に表示され、終了コードは 0 である
