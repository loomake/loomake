## MODIFIED Requirements

### Requirement: 品質コマンドの実行
`--done` は、`loomake.config.json` の `commands`（lint・typecheck・test）を実行し、1 つでも失敗したら不合格にする SHALL。verify は、どのモードでも、loomake.config.json に知らないキーがあれば、そのキーを警告として表示する SHALL。知らないキーがあっても不合格にはしない SHALL。

Source: REQ-039

#### Scenario: コマンドが失敗する
- **WHEN** `commands.test` が終了コード 1 で終わる設定で `--done` を実行する
- **THEN** `command: test` が不合格になり、出力の末尾が詳細に含まれる

#### Scenario: すべて成功する
- **WHEN** 3 つのコマンドがすべて終了コード 0 で終わる設定で `--done` を実行する
- **THEN** 3 つの `command:` 検査がすべて合格する

#### Scenario: 知らないキーがある
- **WHEN** loomake.config.json に `comands` のキーがあるプロジェクトで `loomake verify` を実行する
- **THEN** 「loomake.config.json」の検査が警告になり、`comands` が表示され、ほかに不合格がなければ終了コードは 0 である
