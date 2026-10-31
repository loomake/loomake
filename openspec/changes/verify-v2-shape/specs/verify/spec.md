## ADDED Requirements

### Requirement: quality.yamlの最小読取
verifyのchange必須ゲートはプロジェクトルートのquality.yamlを読み、既存のversion 2スキーマと既定値を適用する SHALL。YAML構文・型・対応版・対象外理由の不正はconfigのaborted、完了ゲートで必要なquality.yamlの不在や権限などの読取不能はruntime/permissionのabortedとする MUST。spec-onlyではquality.yamlの不在を許し品質構造検査を対象外とする SHALL。存在するファイルの不正や読取不能はspec-onlyでも同じabortedとする MUST。設定ファイル内容の誤り2と読取不能3を区別する MUST。既存導入へ最小ファイルの手動作成を案内する SHALL。

Source: REQ-310

#### Scenario: 最小入力と未知キー
- **WHEN** versionとmodelを持つ最小quality.yaml、および未知キーを含む入力を読む
- **THEN** スキーマの既定値を補い、未知値を失わず、空の評価対象を完了ゲートのPASSにしない

#### Scenario: 不正・不在・権限エラー
- **WHEN** YAML構文不正・version不正、完了ゲートのファイル不在、読取権限不足をそれぞれ発生させる
- **THEN** 前2者は終了コード2、不在・権限不足は終了コード3のabortedで返し、nextに設定の修正・最小ファイル作成・権限確認を示す


#### Scenario: 仕様ゲートにquality.yamlがない
- **WHEN** quality.yamlのないプロジェクトで既存changeの --spec-only を実行する
- **THEN** 品質構造検査を対象外とし、quality不在だけではabortedや品質不足を作らない。ほかの仕様検査の合否を保持する
