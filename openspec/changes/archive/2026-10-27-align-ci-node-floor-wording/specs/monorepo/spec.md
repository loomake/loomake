## MODIFIED Requirements

### Requirement: 対応環境での配布物の検証
CIは3OSのNode24で配布物の主要コマンドを検証し、過去の下限Node20.19.0でも追加で確認する SHALL。配布物の宣言する下限Node22.12.0での確認は「Node.js のバージョン宣言」に従う。開発ツールを使う準備はNode24で行い、ランタイムの確認は指定したNodeで行う SHALL。

Source: REQ-144

#### Scenario: Node下限で検査する
- **WHEN** Node24で準備した配布物を、過去の下限Node20.19.0で使う
- **THEN** 開発ツールを実行せず主要コマンドの動作を確認する
