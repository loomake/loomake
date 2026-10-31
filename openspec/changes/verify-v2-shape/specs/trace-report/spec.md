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
