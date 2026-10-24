## ADDED Requirements

### Requirement: エンジンの子プロセスの停止
時間切れか中断でエンジンを止めるとき、その子プロセスも停止する SHALL。終了要求を無視するプロセスは、終了を待つ猶予を設けた後に強制終了する SHALL。開始前に中断済みの場合はエンジンを起動しない SHALL。

Source: REQ-139

#### Scenario: 子が出力先を保持する
- **WHEN** エンジンが標準出力を継承した子プロセスを起動し、時間切れになる
- **THEN** 親と子が停止し、終了待ちが子の自然終了まで続かない

#### Scenario: 終了要求を無視する
- **WHEN** POSIXのエンジンがSIGTERMを無視したまま時間切れになる
- **THEN** 猶予後に強制終了し、不合格として停止する

#### Scenario: 中断済み
- **WHEN** 起動前に中断の合図が出ている
- **THEN** エンジンを起動せず中断として返す

### Requirement: 証拠記録の再検証の時間制限
自動実装から証拠記録の完了ゲートを再実行するときも、実行時間の残りを上限とする SHALL。上限に達したときは品質コマンドと子プロセスを停止し、PRを作成せず終了コード1で止まる SHALL。

Source: REQ-140

#### Scenario: 二度目の検査が停止しない
- **WHEN** 最初の完了ゲートは合格し、証拠記録の検査中に時間の上限に達する
- **THEN** 品質コマンドを止め、PRを作成せず、時間切れを理由として記録する

### Requirement: run設定の形の検証
run設定はオブジェクトであることを検証する SHALL。maxFixesは正の安全な整数、timeoutMinutesは正の有限数を受け付ける SHALL。不正な設定は日本語で説明し、UsageErrorとして終了コード2で返す SHALL。

Source: REQ-141

#### Scenario: 不正な形
- **WHEN** runがnull・配列・文字列である
- **THEN** TypeErrorではなく日本語の設定エラーで終了する

#### Scenario: 不正な数値
- **WHEN** maxFixesが小数か安全な整数の範囲外、またはtimeoutMinutesが有限数でない
- **THEN** 設定エラーとして拒否する

#### Scenario: 既定値と正しい設定
- **WHEN** runを省略するか正しい設定を渡す
- **THEN** 既定値または指定した値で実行できる

