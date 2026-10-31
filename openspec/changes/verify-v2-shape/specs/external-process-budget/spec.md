## MODIFIED Requirements

### Requirement: verifyとtraceの接続と互換性
verifyのOpenSpec検証とtraceのGitも共通の期限を使う SHALL。品質コマンドの明示した合計予算を維持し、制限による失敗を結果へ記録する SHALL。予算を指定しない単独verifyの品質コマンドは従来の期限なしの動作を維持する SHALL。コマンドの引数・cwd・環境・stdout/stderr・実行ファイル不存在の判定を維持し、実行予算/後片付けだけの変更では依存境界とJSONの版を変えない SHALL。形式の版を上げる別のchangeは予算単独変更の対象外とし、この不変条件をその別changeに適用しない SHALL。

Source: REQ-183

#### Scenario: OpenSpecの検証が終わらない
- **WHEN** OpenSpec検証が期限を超える
- **THEN** 検証は理由を持つ不合格となり、成功やCLI不存在として扱わない
