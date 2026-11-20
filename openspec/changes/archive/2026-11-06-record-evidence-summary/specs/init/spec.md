## MODIFIED Requirements

### Requirement: 品質目標未設定の雛形の配置
`loomake init`はプロジェクト直下にversion 2のスキーマで読める、品質目標未設定の`quality.yaml`を配置し、結果の一覧に含める SHALL。作成・上書きしたときは、完了ゲートの前に案件の品質の対象と合格に必要な証拠を設定するよう日本語で案内する SHALL。品質目標を`loomake.config.json`へ混ぜない MUST。既存ファイルの保護（REQ-020）をこの配置にも適用する MUST。雛形には既存の証跡保管方針の既定値を明記する SHALL。

Source: REQ-396

#### Scenario: 空のプロジェクトに雛形を置く
- **WHEN** 空のディレクトリで`loomake init`を実行する
- **THEN** 既存の配置物と`quality.yaml`が作られ、一覧に「作成：quality.yaml」が含まれ、終了コードは0となる。雛形はversion 2として読め、品質の対象は未設定で、対象・証拠の設定案内が出る

#### Scenario: 雛形だけでは完了ゲートに合格しない
- **WHEN** 有効なchangeと必要な他の条件を満たしたプロジェクトで、雛形の品質の対象を未設定のまま`--done --scope ci`（scope省略時の既定）を実行する
- **THEN** 品質の対象の判定はINSUFFICIENT_EVIDENCEとなり、空対象だけでPASSを返さない

#### Scenario: 既存の雛形を保護する
- **WHEN** 既存の`quality.yaml`が同じ内容、または異なる内容でTTYで拒否・承諾、または非TTYで差分がある状態で、`--yes` と `--keep-existing` を指定せずにinitを実行する
- **THEN** 同内容は無確認で変更せず、拒否は既存内容を残し、承諾時だけ上書きする。非TTYでの差分はどのファイルも配置せず終了コード1となる。対象・証拠の設定案内は作成・上書きした場合だけ出る

#### Scenario: 雛形の置き先が安全でない
- **WHEN** `quality.yaml`が外部を指すリンクまたはリンク先のないリンクである
- **THEN** initはリンク先を読まず差分を表示せず、どのファイルも配置せず終了コード1となる

#### Scenario: 配布物を空のGitリポジトリへ導入する
- **WHEN** tarballからインストールしたCLIで、空のGitリポジトリへinitを実行する
- **THEN** 既存の配置物と`quality.yaml`が一覧に出て終了コード0となる。`--codex`と`--devcontainer`の有無による既存の配置条件は変わらない


#### Scenario: 証跡保管方針の既定値
- **WHEN** 新規のquality.yaml雛形を解析する
- **THEN** evidenceのartifact_retentionは90d、long_term_storeはgithub-release、long_term_retentionは5y、accessはproject-members、delete_policyはowner-approvalで、品質の対象は未設定のままである
