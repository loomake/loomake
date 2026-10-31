## MODIFIED Requirements

### Requirement: 仕様ゲートの確認
`loomake run --change <id>` は、最初にその change の仕様ゲート（`verify --spec-only` と同じ検査）を実行し、不合格なら実装を始めずに、不合格の内容を表示して終了コード 1 を返す SHALL。仕様ゲートがusage・configのabortedなら終了コード2、それ以外のabortedなら3を返し、実行エラーの理由を表示する SHALL。不合格とabortedのどちらでも、実装ブランチを作らずエンジンを呼ばない MUST。既存の change のブランチへ切り替えてから仕様ゲートを実行したときは、不合格・aborted・仕様ゲートの例外のいずれでも、元のブランチへ戻してから終わる SHALL。

Source: REQ-093

#### Scenario: 仕様ゲートに不合格
- **WHEN** 未回答のブロッキング確認事項がある change に `loomake run --change c1` を実行する
- **THEN** 確認事項の内容が表示され、ブランチは作られず、エンジンは呼ばれず、終了コードは 1 である

#### Scenario: 仕様ゲートに合格
- **WHEN** 仕様ゲートに合格する change に `loomake run --change c1` を実行する
- **THEN** 実装に進む

#### Scenario: 仕様ゲートがabortedになる
- **WHEN** 仕様ゲートがusage・configの実行エラー、またはそれ以外の実行エラーでabortedを返す
- **THEN** 前者は終了コード2、後者は3を返し、ブランチは作られず、エンジンは呼ばれない

#### Scenario: 既存のブランチで仕様ゲートが例外になる
- **WHEN** `loomake/c1` のブランチがあるリポジトリで、別のブランチから `loomake run --change c1` を実行し、仕様ゲートが使い方の誤りの例外で止まる
- **THEN** 終了コードは 2 で、作業ツリーは元のブランチに戻り、エンジンは呼ばれない
