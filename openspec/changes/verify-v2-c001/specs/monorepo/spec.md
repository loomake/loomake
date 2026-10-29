## ADDED Requirements

### Requirement: v2移行の同時追従と配布検証
verify 2.0.0への切替はcoreの公開型・JSON Schema、kit、CLI、ci-gate、runner、traceの利用側を同じchangeで追従させる MUST。ci-gateはciの実行状態・decision・verdictを確認し、local・旧形式・skip/neutralだけを最終合格にしない MUST。既存fixtureを保持して新fixtureを追加し、公開型・CLI/APIの一致・tarball・生成JSON一致を検証する SHALL。形式版とパッケージ版を分け、破壊的公開契約にはminor changesetと移行説明を付ける SHALL。

Source: REQ-318

#### Scenario: 旧結果とlocalをゲートへ渡す
- **WHEN** old ok:true、local完了、ciで必要検証がskip/neutralの結果をci-gateへ渡す
- **THEN** 合格として受け入れず、必要なciの実施と結果を要求する

#### Scenario: 実配布物と移行
- **WHEN** 新しいtarballから公開型・JSON・CLIを利用し、旧fixtureの履歴閲覧も試す
- **THEN** 同じchangeの利用側が動作し、verify 2.0.0/Evidence 2と履歴版を区別する。Report 2とRunSummaryの外形、無関係の6 JSONを維持する
