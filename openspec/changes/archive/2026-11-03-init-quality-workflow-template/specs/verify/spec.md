## ADDED Requirements

### Requirement: 品質ファイル不在時に読取と合格の条件を区別する案内
ciの完了ゲートで`quality.yaml`がないとき、verifyのnextはversionとmodelの2行が読取りの最小であり、合格には品質の対象と合格に必要な証拠を別に設定する必要があると日本語で示す SHALL。不在のruntime分類・終了コード3、2行の読取互換、ciの空対象と証拠不足を合格にしない条件、localの不在許容を保持する MUST。

Source: REQ-398

#### Scenario: 不在時の案内
- **WHEN** 有効なchangeを指定し、`quality.yaml`がないプロジェクトで`--done --scope ci`（scope省略時の既定）を実行する
- **THEN** aborted・runtime・終了コード3を返し、nextに「最小の quality.yaml」「品質の対象」「証拠」が含まれ、2行を作るだけで完了ゲートに合格できるとは案内しない

#### Scenario: 最小ファイルと不足を区別する
- **WHEN** versionとmodelの2行だけのファイル、またはその内容に未知キーを足したファイルを読み、必要な他の条件を満たしたchangeの`--done --scope ci`を実行する
- **THEN** 既存の読取互換を保ち、空の品質の対象はINSUFFICIENT_EVIDENCEとなる。適格な実証跡がない品質の対象を追加するだけでもPASSにはならない

#### Scenario: 不正と仕様ゲートの分類を保持する
- **WHEN** YAML構文不正・型や版の不正・権限不足を与えた場合と、ファイル不在で仕様ゲートまたはlocalの完了ゲートを実行した場合を検査する
- **THEN** 構文・型・版の不正はconfig・終了コード2、権限不足はpermission・終了コード3のabortedとなる。仕様ゲートとlocalの完了ゲートのファイル不在は許容され、ほかの検査の合否を保持する
