## MODIFIED Requirements

### Requirement: 使った証拠の記載
レポートは、使った証拠の記録の、記録した日時・検査したコミットの SHA・コミットの日時を記載する SHALL。証拠の記録に、JSON として読めないファイルと、`schemaVersion` がEvidence 1/verify 1.0.0またはEvidence 2/verify 2.0.0の対応する版でないか、レポートが使う欄の形が違うか、`change` が change-id と違うファイルがあるときは、そのファイルのパスを日本語で示し、使い方の誤りとして終了コード 2 を返す SHALL。

Source: REQ-073

#### Scenario: 記録の情報が載る
- **WHEN** SHA が `0123456789ab…` の記録を使って `loomake trace report` を実行する
- **THEN** レポートに、その記録の記録した日時・SHA・コミットの日時が載る

#### Scenario: 読めない記録がある
- **WHEN** `.loomake/evidence/c1/` に JSON として壊れたファイルがある change に `loomake trace report --change c1` を実行する
- **THEN** そのファイルのパスと、読めないことが日本語で表示され、スタックトレースは出ず、終了コードは 2 である

#### Scenario: 読めない版の記録がある
- **WHEN** `.loomake/evidence/c1/` に `schemaVersion` が1と2以外の未対応版の記録がある change に `loomake trace report --change c1` を実行する
- **THEN** そのファイルのパスと、読める版でないことが日本語で表示され、終了コードは 2 である

#### Scenario: 形の違う記録がある
- **WHEN** `.loomake/evidence/c1/` に Evidence 1で`verify.results`がない記録、またはEvidence 2で2.0.0の状態別必須欄がない記録がある change に `loomake trace report --change c1` を実行する
- **THEN** そのファイルのパスと、その版のverify構造が違うことが日本語で表示され、スタックトレースは出ず、終了コードは 2 である

#### Scenario: ほかの change の記録がある
- **WHEN** `.loomake/evidence/c1/` に `change` が c2 の記録がある change に `loomake trace report --change c1` を実行する
- **THEN** そのファイルのパスと、ほかの change の記録であることが日本語で表示され、終了コードは 2 である

## ADDED Requirements

### Requirement: 新旧証拠の閲覧と既存レポート外形
trace reportは旧Evidence 1/verify 1.0.0と新Evidence 2/verify 2.0.0を版に応じて読み、ReportのschemaVersion 2・既存外形・日本語の行結果を維持する SHALL。v2 checksの理由と対応証拠から既存行・failedChecksへ投影し、local・aborted・不足を最終CI合格と表示しない MUST。旧形式は歴史的結果の閲覧に限ることを既存warningsで示す SHALL。旧証拠を新しいPASS証拠へ変換・再保存・自動再利用しない MUST。

Source: REQ-316

#### Scenario: 旧fixtureの閲覧
- **WHEN** documentsあり/なしの旧Evidence 1とverify 1.0.0からレポートを作る
- **THEN** 旧fixtureを変更せず従来の行と説明を表示し、履歴閲覧専用という警告を加える。現在の合格根拠には使わない

#### Scenario: 新しい実施結果の投影
- **WHEN** v2のciのFAIL/不足、local完了、abortedを表示する
- **THEN** Report 2の既存型へ投影し、該当する要注意と理由を残す。local完了を最終CI合格と呼ばず、abortedに存在しないchecksや成功したテストを生成しない
