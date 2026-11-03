## ADDED Requirements

### Requirement: verify設定の読取不能の分類
verifyは、存在するloomake.config.jsonの読取不能を実行時の失敗として扱い、CLIのJSON出力ではruntimeのabortedと終了コード3を返すMUST。JSON構文・設定内容の誤りはconfigのabortedと2、設定省略時は既存の既定値を保つMUST。JSONの形、入力予算・リンク拒否とverify以外の共有設定読取の契約を変えないMUST。

Source: REQ-395

#### Scenario: 存在する設定を読めない
- **WHEN** 設定の読取りが失敗し、verifyをJSONあり/なしで実行する
- **THEN** どちらも3で、JSONだけをstdoutへ出しruntimeのabortedにする。APIの例外も共通分類で3となり、使い方を表示しない
#### Scenario: 構文・内容の誤りと不在
- **WHEN** 不正JSON・不正な設定内容・設定の不在でverifyを実行する
- **THEN** 不正入力はconfigのaborted/2、不在は既存の既定値となり、内容不正を実行時の失敗へ変えない
#### Scenario: 共有読取と入力制約
- **WHEN** 同じ読取不能を共有loadConfigの利用側へ渡すか、入力予算超過やリンクを設定として渡す
- **THEN** verify以外のUsageError契約と入力拒否を維持し、verifyは読取失敗を3へ分ける
