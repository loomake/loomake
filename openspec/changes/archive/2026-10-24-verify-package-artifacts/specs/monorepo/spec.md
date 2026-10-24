## ADDED Requirements

### Requirement: 配布物からの主要コマンドの検証
5パッケージのtarballを別プロジェクトへオフラインで導入し、公開APIとJSONスキーマ、help・version・init・doctor・verifyの仕様と完了ゲート・trace recordとreportを検証する SHALL。失敗時は終了コード0を返さない SHALL。

Source: REQ-143

#### Scenario: 配布物を検証する
- **WHEN** ビルドした5パッケージをpackして検証する
- **THEN** ワークスペースのsrcに依存せず主要コマンドが成功する

### Requirement: 対応環境での配布物の検証
CIは3OSのNode24と実行時下限Node20.19.0で配布物の主要コマンドを検証する SHALL。開発ツールを使う準備はNode24で行い、ランタイムの確認は指定したNodeで行う SHALL。

Source: REQ-144

#### Scenario: Node下限で検査する
- **WHEN** Node24で準備した配布物をNode20.19.0で使う
- **THEN** 開発ツールを実行せず主要コマンドの動作を確認する

### Requirement: 公開対象コミットの品質ゲート
公開ワークフローは、公開対象のコミットでlint・型検査・テスト・ビルドと配布物の検証を行い、いずれかが失敗すると公開しない SHALL。認証情報は公開を行うステップに限定する SHALL。

Source: REQ-145

#### Scenario: 検査に失敗する
- **WHEN** 公開対象コミットの品質検査か配布物の検査が失敗する
- **THEN** publishのステップに進まない

### Requirement: 公開するexportsの参照先
公開するパッケージのexportsは、tarballにあるファイルを参照する SHALL。開発時の@loomake/source条件は公開するexportsに含めない SHALL。ワークスペースでのソース参照は維持する SHALL。

Source: REQ-146

#### Scenario: 公開物と開発環境を分ける
- **WHEN** ワークスペースとpackしたパッケージを読む
- **THEN** 開発環境ではソースを参照でき、公開物は同梱したdistとschemaを参照する

