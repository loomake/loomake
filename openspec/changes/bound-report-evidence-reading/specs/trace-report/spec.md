## ADDED Requirements

### Requirement: 使う証拠だけを読む
`loomake trace report` は、`.loomake/evidence/<change-id>/` の証拠のうち、ファイル名の日時（`YYYYMMDDTHHMMSSZ`、秒まで）がいちばん新しい秒の証拠だけを読んで検証する SHALL。その秒の証拠が複数あるときは、記録した日時（`recordedAt`、ミリ秒まで）がいちばん新しいものをレポートに使う SHALL。ほかの証拠は読まない SHALL。証拠の数が増えても、読み取りの合計の上限で失敗しない SHALL。

Source: REQ-209

#### Scenario: 古い証拠が多い
- **WHEN** 1 つは小さいが、合わせると 128MiB を超える古い証拠が多数ある change に `loomake trace report` を実行する
- **THEN** いちばん新しい証拠を使ってレポートを出し、終了コードは 0 である

#### Scenario: 最新の証拠が壊れている
- **WHEN** ファイル名の日時がいちばん新しい証拠が JSON として壊れている
- **THEN** そのファイルを日本語で示し、終了コード 2 を返す

#### Scenario: 同じ秒の証拠
- **WHEN** 同じ秒に記録した証拠が 2 つあり、記録した日時が `.100Z` の証拠は合格、`.900Z` の証拠は不合格である
- **THEN** `.900Z` の証拠を使い、レポートの検査の結果は不合格になる
