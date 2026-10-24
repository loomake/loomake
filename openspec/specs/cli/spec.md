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

### Requirement: 実行時の失敗の終了コード
外部操作（品質コマンド・git・OpenSpec CLI・gh など）が時間の上限・出力の上限・中断で止まり、そのコマンドの処理を続けられないときは、`loomake <コマンド>: <理由>` を日本語で標準エラーに出し、使い方を表示せずに終了コード 3 を返す SHALL。使い方や設定の誤りは、これまでどおり終了コード 2 とする SHALL。

Source: REQ-192

#### Scenario: 外部操作が時間の上限で止まる
- **WHEN** サブコマンドの処理中に、外部操作が時間の上限で止まり、処理を続けられない
- **THEN** 理由が日本語で標準エラーに出て、使い方は表示されず、終了コードは 3 である

#### Scenario: 使い方の誤りは変わらない
- **WHEN** `loomake verify --spec-only` を `--change` なしで実行する
- **THEN** 終了コードは 2 である

### Requirement: 値をとるオプションの書き方
値をとるオプション（`--change`・`--engine`・`--format`）は、`--name value` に加えて `--name=value` の形も受け付ける SHALL。`--name=` のように値が空のときは、使い方の誤りとする SHALL。

Source: REQ-194

#### Scenario: 等号で値を渡す
- **WHEN** `loomake verify --change=<id> --spec-only` を実行する
- **THEN** `--change <id>` と同じ結果になる

#### Scenario: 値が空
- **WHEN** `loomake verify --change= --spec-only` を実行する
- **THEN** 値を続けるよう日本語で表示され、終了コードは 2 である

### Requirement: 打ち間違いの候補
知らないサブコマンドと、サブコマンドの知らないオプションには、編集距離が 2 以下の候補があれば「もしかして：<候補>」を日本語で添える SHALL。候補がなければ添えない SHALL。終了コードは 2 とする SHALL。

Source: REQ-195

#### Scenario: サブコマンドの打ち間違い
- **WHEN** `loomake verfy` を実行する
- **THEN** 標準エラーに「もしかして：verify」が含まれ、終了コードは 2 である

#### Scenario: オプションの打ち間違い
- **WHEN** `loomake verify --chnage c1 --spec-only` を実行する
- **THEN** 標準エラーに「もしかして：--change」が含まれ、終了コードは 2 である

#### Scenario: 近い候補がない
- **WHEN** `loomake zzzzzzzz` を実行する
- **THEN** 「もしかして」は表示されず、終了コードは 2 である
