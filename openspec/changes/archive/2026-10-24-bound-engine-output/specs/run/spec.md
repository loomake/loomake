## ADDED Requirements

### Requirement: エンジンの出力予算
エンジンのstdoutとstderrの合計に既定64MiBの上限を設ける SHALL。収集と転送は上限以内とし、UTF-8の途中で切れる文字は出力しない SHALL。上限を超えたときはエンジンと子プロセスを停止する SHALL。上限内の通常の出力と時間切れ・中断の扱いは維持する SHALL。

Source: REQ-151

#### Scenario: 標準出力が上限を超える
- **WHEN** エンジンが上限を超える標準出力を返す
- **THEN** 収集する出力は上限以内となり、エンジンと子を止める

#### Scenario: 標準エラーが上限を超える
- **WHEN** エンジンがstdoutとstderrを合わせて上限を超える出力を返す
- **THEN** 転送するstderrを含む合計は上限以内となり、エンジンを止める

#### Scenario: 複数バイト文字の途中
- **WHEN** 上限の境界に日本語の複数バイト文字がある
- **THEN** 途中で切れた文字を転送せず、上限以内の完全な文字だけを保持する

### Requirement: 出力予算の設定と停止結果
run.maxOutputBytesに正の安全な整数を設定できる SHALL。不正な値は日本語のUsageErrorとする SHALL。出力が上限を超えたときは、理由を出力とsummaryに残して終了コード1で止まり、対象タスクを完了にせず、コミットとPRを作らない SHALL。

Source: REQ-152

#### Scenario: 設定した上限で停止する
- **WHEN** run.maxOutputBytesに小さな上限を設定し、エンジンが超過する
- **THEN** 上限超過を理由に停止し、対象タスクは未完了で、コミットとPRが増えない

#### Scenario: 不正な設定
- **WHEN** run.maxOutputBytesが0・小数・安全な整数でない値である
- **THEN** エンジンを動かさず、日本語の設定エラーで終了コード2を返す
