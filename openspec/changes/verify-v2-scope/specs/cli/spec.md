## MODIFIED Requirements

### Requirement: ヘルプと版
`loomake --help`（`-h`）は、サブコマンドの一覧とそれぞれの説明を標準出力に表示し、終了コード 0 を返す SHALL。`loomake <サブコマンド> --help`（`-h`）は、そのサブコマンドの使い方を標準出力に表示し、ほかの処理をせずに終了コード 0 を返す SHALL。サブコマンドの使い方には、使い方の行と、説明と、各オプションの説明を載せる SHALL。`loomake trace record --help` と `loomake trace report --help` は、それぞれの使い方を表示する SHALL。`loomake --version`（`-v`）は、loomake の版を標準出力に表示し、終了コード 0 を返す SHALL。

Source: REQ-135

#### Scenario: 全体のヘルプ
- **WHEN** `loomake --help` を実行する
- **THEN** init・verify・trace・run・doctor の名前と説明が表示され、終了コードは 0 である

#### Scenario: サブコマンドのヘルプ
- **WHEN** `loomake verify --help` を実行する
- **THEN** verify の使い方と、`--change`・`--spec-only`・`--done`・`--json`・`--skip-commands`・`--scope local|ci` の説明が表示される。doneの既定ci、spec-onlyとchangeなしの既定local、changeなしの明示ci拒否、skipの不足（終了コード1）とcoverage省略も読め、検査は実行されず、終了コードは 0 である

#### Scenario: trace の record のヘルプ
- **WHEN** `loomake trace record --help` を実行する
- **THEN** trace record の使い方と `--scope local|ci` の受理値・既定ciが表示され、trace report の `--format` の説明は表示されず、記録は実行されず、終了コードは 0 である

#### Scenario: 版
- **WHEN** `loomake --version` を実行する
- **THEN** loomake の package.json の version が表示され、終了コードは 0 である

### Requirement: 値をとるオプションの書き方
値をとるオプション（`--change`・`--engine`・`--format`・`--scope` など）は、`--name value` に加えて `--name=value` の形も受け付ける SHALL。`--name=` のように値が空のときは、使い方の誤りとする SHALL。`--scope` の値は local か ci に限り、それ以外は使い方の誤りとして終了コード 2 を返す SHALL。

Source: REQ-194

#### Scenario: 等号で値を渡す
- **WHEN** `loomake verify --change=<id> --spec-only` を実行する
- **THEN** `--change <id>` と同じ結果になる

#### Scenario: 値が空
- **WHEN** `loomake verify --change= --spec-only` を実行する
- **THEN** 値を続けるよう日本語で表示され、終了コードは 2 である

#### Scenario: scopeの値
- **WHEN** `loomake verify --change <id> --spec-only --scope=local` と `--scope local` を実行し、別に `--scope=`・`--scope ci2` で実行する
- **THEN** 前の2つは同じ結果になり、後の2つは日本語の案内と使い方を表示して終了コード 2 になる。trace record の `--scope` も同じ値だけを受理する

### Requirement: オプションの書き方と知らないコマンド
値を取るオプション（`--change`・`--engine`・`--format`・`--scope` など）は、`--change <id>` の形と `--change=<id>` の形のどちらでも受け付ける SHALL。知らないコマンドを指定したときは、そのコマンドの名前を挙げて知らないことと、使い方を日本語で表示し、終了コード 2 を返す SHALL。

Source: REQ-041

#### Scenario: = でつないだ値
- **WHEN** `loomake verify --change=c1 --spec-only` を実行する
- **THEN** `loomake verify --change c1 --spec-only` と同じ検査が実行される

#### Scenario: 知らないコマンド
- **WHEN** `loomake foo` を実行する
- **THEN** 「知らないコマンドです：foo」と使い方が表示され、終了コードは 2 である
