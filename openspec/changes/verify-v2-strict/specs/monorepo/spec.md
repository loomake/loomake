## ADDED Requirements

### Requirement: v2移行の同時追従と配布検証
配布されたcore・kit・CLI・trace・runnerの公開入口は現行verify 2.0.0とEvidence 2を同じ契約で処理できる MUST。ci-gateはciの実行状態・decision・verdictを確認し、local・旧形式・skip/neutralだけを最終合格にしない MUST。配布tarballの公開型・CLI/API・生成JSON Schemaの版と内容は一致する SHALL。履歴版は別の型・スキーマとして利用でき、移行説明には形式版とパッケージ版、終了コードとJSONの変更を記載する SHALL。

Source: REQ-318

#### Scenario: 旧結果とlocalをゲートへ渡す
- **WHEN** old ok:true、local完了、ciで必要検証がskip/neutralの結果をci-gateへ渡す
- **THEN** 合格として受け入れず、必要なciの実施と結果を要求する

#### Scenario: 実配布物と移行
- **WHEN** 新しいtarballから公開型・JSON・CLIを利用し、旧fixtureの履歴閲覧も試す
- **THEN** 配布された各利用側が動作し、verify 2.0.0/Evidence 2と履歴版を区別する。Report 2とRunSummaryの外形、無関係の6 JSONを維持する

#### Scenario: 完了ゲート以外の結果と全件NOT_APPLICABLE
- **WHEN** ci-gateが `--done` で検査したchangeに対し、別のchangeの結果、仕様ゲートや品質コマンドだけの結果、検査が0件か全件NOT_APPLICABLEの結果、終了コードは0でもverdictがPASSでない結果を受け取る
- **THEN** 終了コードだけで合格にせず、対象のchangeと完了ゲートの検査を含む2.0.0のci・completed・要判断なし・PASSの結果を要求して失敗する
