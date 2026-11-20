## ADDED Requirements

### Requirement: verify の戻り値・進捗・表示の置換

verify は、戻り値・進捗・失敗した外部コマンドの出力・整形した文字列・CLI のエラー表示に、REQ-118・REQ-199 の既知の秘密の形を残さず `***` に置き換える SHALL。外部コマンドの出力は、全文を置換してから既存の上限で切る MUST。戻り値の `change` は呼び出し側が渡した識別子なので置換せず、利用者へ出す表示の境界で置換する。結果の形・判定・終了コードは変えない MUST。

Source: REQ-451

#### Scenario: 失敗した品質コマンドの出力にあるトークンを伏せる
- **WHEN** 品質コマンドが既知の形のトークンを出力して失敗する
- **THEN** 戻り値のその check の reason にトークンはなく、`***` がある
- **AND** check の結果は FAIL のままで、終了コードは変わらない

#### Scenario: 末尾 30 行へ切る前に秘密鍵ブロックを置換する
- **WHEN** 品質コマンドが BEGIN 行、本文 40 行、END 行の順に出力して失敗する
- **THEN** reason の末尾 30 行に鍵の本文は 1 行も残らない
- **AND** 秘密のない出力の末尾 30 行の上限は変わらない

#### Scenario: openspec validate の失敗出力を置換する
- **WHEN** `openspec validate` が既知の形のトークンを出力して失敗する
- **THEN** 戻り値の `openspec validate` の reason にトークンはなく、先頭 2000 文字の上限は変わらない

#### Scenario: 進捗に出すコマンドの文字列を置換する
- **WHEN** 設定した品質コマンドの文字列に既知の形のトークンが含まれる
- **THEN** progress に渡す文字列にトークンはなく、コマンドは設定どおりに実行される

#### Scenario: 実行エラーと aborted の message を置換する
- **WHEN** 実行エラーまたは中止の message に既知の形のトークンが含まれる
- **THEN** `assembleVerifyResult` と `verifyAbortedResult` の戻り値の message にトークンはない
- **AND** 使い方・設定・実行時の分類と終了コードは、置換前の message で決まったとおりになる

#### Scenario: 早期の aborted の戻り値を置換する
- **WHEN** quality.yaml の読取エラーの message に既知の形のトークンが含まれ、runVerify が aborted を返す
- **THEN** 戻り値にトークンはない

#### Scenario: 整形した文字列を置換する
- **WHEN** 既知の形のトークンを含む verify の結果を `formatVerifyResult` に渡す
- **THEN** 返す文字列にトークンはなく、結果の形と秘密のない文章は変わらない

#### Scenario: CLI のエラー表示を置換する
- **WHEN** verify が既知の形のトークンを含む message で使い方の誤りまたは実行時の失敗になる
- **THEN** 標準エラーにトークンはなく、`--json` のときの標準出力は置換済みの aborted を単独の JSON で出す
- **AND** 終了コードは 2 または 3 のままである

#### Scenario: 秘密のない出力は変えない
- **WHEN** 既知の形を含まない verify を実行する
- **THEN** 戻り値・進捗・整形した文字列・標準エラーは置換前と同じである

#### Scenario: 秘密の形の change ID は、戻り値では渡した値のままにし、表示では伏せる
- **WHEN** change ID が既知の形の秘密に一致する
- **THEN** 戻り値の `change` は渡した値のままである
- **AND** `formatVerifyResult` の文字列と、CLI の標準出力・標準エラーに、その値は残らない
