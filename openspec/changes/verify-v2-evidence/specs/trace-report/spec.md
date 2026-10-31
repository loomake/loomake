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
- **THEN** そのファイルのパスと、その版が読める版（1と2）でないことが日本語で表示され、終了コードは 2 である

#### Scenario: 版の混在した記録がある
- **WHEN** `.loomake/evidence/c1/` に Evidence 1にverify 2.0.0を入れた記録、またはEvidence 2にverify 1.0.0を入れた記録がある change に `loomake trace report --change c1` を実行する
- **THEN** そのファイルのパスと、証拠の版とverifyの版が混在していることが日本語で表示され、読める版を1だけと案内せず、終了コードは 2 である

#### Scenario: 形の違う記録がある
- **WHEN** `.loomake/evidence/c1/` に Evidence 1で`verify.results`がない記録、またはEvidence 2で2.0.0の状態別必須欄がない記録がある change に `loomake trace report --change c1` を実行する
- **THEN** そのファイルのパスと、形の違う欄（Evidence 2では、その`run.status`で必須の欄であること）が日本語で表示され、スタックトレースは出ず、終了コードは 2 である

#### Scenario: ほかの change の記録がある
- **WHEN** `.loomake/evidence/c1/` に `change` が c2 の記録がある change に `loomake trace report --change c1` を実行する
- **THEN** そのファイルのパスと、ほかの change の記録であることが日本語で表示され、終了コードは 2 である
