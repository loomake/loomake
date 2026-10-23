# cli Specification

## Purpose
`loomake` の CLI 全体に共通する振る舞いを定める。全体とサブコマンドごとのヘルプと、版の表示を含む。

## Requirements

### Requirement: ヘルプと版
`loomake --help`（`-h`）は、サブコマンドの一覧とそれぞれの説明を標準出力に表示し、終了コード 0 を返す SHALL。`loomake <サブコマンド> --help`（`-h`）は、そのサブコマンドの使い方を標準出力に表示し、ほかの処理をせずに終了コード 0 を返す SHALL。`loomake --version`（`-v`）は、loomake の版を標準出力に表示し、終了コード 0 を返す SHALL。

Source: REQ-135

#### Scenario: 全体のヘルプ
- **WHEN** `loomake --help` を実行する
- **THEN** init・verify・trace・run・doctor の名前と説明が表示され、終了コードは 0 である

#### Scenario: サブコマンドのヘルプ
- **WHEN** `loomake verify --help` を実行する
- **THEN** verify の使い方が表示され、検査は実行されず、終了コードは 0 である

#### Scenario: 版
- **WHEN** `loomake --version` を実行する
- **THEN** loomake の package.json の version が表示され、終了コードは 0 である
