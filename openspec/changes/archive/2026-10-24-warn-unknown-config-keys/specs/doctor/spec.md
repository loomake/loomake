## ADDED Requirements

### Requirement: 設定の知らないキーの診断
`loomake doctor` は、loomake.config.json に知らないキーがあれば、そのキーを注意として表示し、キーを直すよう案内する SHALL。

Source: REQ-134

#### Scenario: 設定に知らないキーがある
- **WHEN** loomake.config.json に `tests.reprot` のキーがある、ほかは整っているプロジェクトで `loomake doctor` を実行する
- **THEN** `tests.reprot` が知らないキーとして注意に表示され、終了コードは 0 である
