## ADDED Requirements

### Requirement: エンジンの結果の純粋な分類とガード後の判断
runnerは、エンジンの標準出力の元の値から正常・失敗・形の異常を返す純粋関数を持つ SHALL。JSONとして読めないか、最上位がnull・配列・オブジェクト以外なら形の異常とする SHALL。次に `is_error` が true か `subtype` が `error_` で始まる文字列なら失敗とする SHALL。次に、`type`・`subtype` があって文字列でないか、`is_error` があって真偽値でないか、`result` が文字列でなければ形の異常とする SHALL。知らない欄と文字列の値、空の `result` は正常とする SHALL。subtype は `error_` に英小文字・数字・`_` の1〜64字が続くときだけ表示する SHALL。ガード後の判断は、不正な直し方か結果の異常があれば停止とし、結果の異常の理由を先に書く SHALL。直接試験は、失敗の優先と理由の順を逆にしたコピーをassertion失敗として検出する SHALL。

Source: REQ-341

#### Scenario: 失敗の合図を型より先に見る
- **WHEN** `subtype` が `error_max_turns` で、`is_error` が文字列の "true" か 1 か null である
- **THEN** 失敗を返す

#### Scenario: 形の異常
- **WHEN** 最上位が配列か null か数値か文字列、`type` が数値、`subtype` が数値、`is_error` が "false"、`result` が欠けているか 42 である
- **THEN** 形の異常を返す

#### Scenario: 知らない値と最小の結果
- **WHEN** `{"result":"x"}` だけである、`type` が `assistant`、`subtype` が `success_partial`、知らない欄が数値・null・オブジェクトである、`result` が空文字列である
- **THEN** 正常を返す

#### Scenario: 表示しない subtype
- **WHEN** 失敗の subtype が `error_` に65字が続く、大文字や `-` を含む、`success` である
- **THEN** 失敗を返し、subtype は表示しない

#### Scenario: 置換前の値で分類する
- **WHEN** 秘密情報の置換で JSON として読めるように変わる標準出力を受け取る
- **THEN** 置換前の値で形の異常とし、保存した出力は置換されている

#### Scenario: ガード後の判断
- **WHEN** 不正な直し方と結果の異常が重なる、どちらか一方がある、どちらもない
- **THEN** 前の2つは停止で、重なったときは結果の異常の理由が先になり、最後は進む

## MODIFIED Requirements

### Requirement: エンジン終了後の純粋な判断
runnerは、観測済みのエンジン終了結果とHEAD・ブランチ・Git内部の変更理由から、続行・保留・停止を返す純粋関数を持つ SHALL。中断、出力上限、時間上限、質問、非ゼロまたは不明な終了コードの順に判定する SHALL。変更理由がある場合はHEAD・ブランチの変更をGit内部の変更より優先し、終了の理由より先に書き、中断の状態を保持する SHALL。これらの停止がなく、REQ-341の結果の異常があれば、変更理由があればその後に結果の理由を書いて停止し、なければ保留を返す SHALL。正常な終了だけなら続行する SHALL。公開されるrunの挙動は、REQ-340の停止のほかは維持する SHALL。

Source: REQ-204

#### Scenario: 複数の停止条件
- **WHEN** 中断・上限・質問・終了コードが重なる
- **THEN** 定めた優先順位で停止し、中断はinterruptedとなる

#### Scenario: Git変更とエンジン終了
- **WHEN** HEADの変更、Git内部の変更、エンジン終了が重なる
- **THEN** HEADの変更理由が先になり、中断の状態と追加の終了理由を保持する

#### Scenario: 正常な終了
- **WHEN** 変更も質問も制限超過も結果の異常もなく終了コード0で終わる
- **THEN** 続行を選ぶ

#### Scenario: 結果の異常だけがある
- **WHEN** 終了コード0で、ほかの停止条件も変更理由もなく、結果の異常がある
- **THEN** 保留を選び、結果の異常の理由を返す

#### Scenario: 結果の異常と先の停止条件
- **WHEN** 結果の異常に、中断・上限・質問・非ゼロの終了コードのどれかが重なる
- **THEN** その停止を選び、保留を選ばず、結果の異常の理由を加えない

#### Scenario: 結果の異常と変更理由
- **WHEN** 結果の異常と、HEADの変更かGit内部の変更が重なる
- **THEN** 停止を選び、変更理由の後に結果の異常の理由を書く
