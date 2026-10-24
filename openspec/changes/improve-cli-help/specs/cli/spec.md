## MODIFIED Requirements

### Requirement: ヘルプと版
`loomake --help`（`-h`）は、サブコマンドの一覧とそれぞれの説明を標準出力に表示し、終了コード 0 を返す SHALL。`loomake <サブコマンド> --help`（`-h`）は、そのサブコマンドの使い方を標準出力に表示し、ほかの処理をせずに終了コード 0 を返す SHALL。サブコマンドの使い方には、使い方の行と、説明と、各オプションの説明を載せる SHALL。`loomake trace record --help` と `loomake trace report --help` は、それぞれの使い方を表示する SHALL。`loomake --version`（`-v`）は、loomake の版を標準出力に表示し、終了コード 0 を返す SHALL。

Source: REQ-135

#### Scenario: 全体のヘルプ
- **WHEN** `loomake --help` を実行する
- **THEN** init・verify・trace・run・doctor の名前と説明が表示され、終了コードは 0 である

#### Scenario: サブコマンドのヘルプ
- **WHEN** `loomake verify --help` を実行する
- **THEN** verify の使い方と、`--change`・`--spec-only`・`--done`・`--json`・`--skip-commands` の説明が表示され、検査は実行されず、終了コードは 0 である

#### Scenario: trace の record のヘルプ
- **WHEN** `loomake trace record --help` を実行する
- **THEN** trace record の使い方が表示され、trace report の `--format` の説明は表示されず、終了コードは 0 である

#### Scenario: 版
- **WHEN** `loomake --version` を実行する
- **THEN** loomake の package.json の version が表示され、終了コードは 0 である

## ADDED Requirements

### Requirement: オプションの書き方と知らないコマンド
値を取るオプション（`--change`・`--engine`・`--format`）は、`--change <id>` の形と `--change=<id>` の形のどちらでも受け付ける SHALL。知らないコマンドを指定したときは、そのコマンドの名前を挙げて知らないことと、使い方を日本語で表示し、終了コード 2 を返す SHALL。

Source: REQ-041

#### Scenario: = でつないだ値
- **WHEN** `loomake verify --change=c1 --spec-only` を実行する
- **THEN** `loomake verify --change c1 --spec-only` と同じ検査が実行される

#### Scenario: 知らないコマンド
- **WHEN** `loomake foo` を実行する
- **THEN** 「知らないコマンドです：foo」と使い方が表示され、終了コードは 2 である
