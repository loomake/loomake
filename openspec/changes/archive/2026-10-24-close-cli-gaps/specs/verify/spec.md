## ADDED Requirements

### Requirement: 品質コマンドを省いたことの表示
`--skip-commands` で品質コマンドを実行しなかったときは、結果に状態 `skip` の項目「品質コマンド」を加え、前回のテストのレポートで判定したことと、完了の確認には `--skip-commands` を付けずに実行することを detail に書く SHALL。人が読む表示の最後の行には、品質コマンドを実行していないことを書く SHALL。合否と終了コードは、これまでどおり不合格の項目の有無で決める SHALL。

Source: REQ-191

#### Scenario: 完了ゲートで品質コマンドを省く
- **WHEN** `verify --change <id> --done --skip-commands` を実行する
- **THEN** 結果に状態 `skip` の「品質コマンド」の項目があり、表示の最後の行に品質コマンドを実行していないことが書かれる

#### Scenario: JSON で品質コマンドを省く
- **WHEN** `verify --change <id> --done --skip-commands --json` を実行する
- **THEN** 出力の `results` に、状態 `skip` の「品質コマンド」の項目が含まれる

#### Scenario: 品質コマンドを実行する
- **WHEN** `--skip-commands` を付けずに `verify --change <id> --done` を実行する
- **THEN** 結果に「品質コマンド」の `skip` の項目は含まれない
