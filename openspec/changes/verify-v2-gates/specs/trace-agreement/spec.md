## MODIFIED Requirements

### Requirement: 仮定を承認する
`loomake trace approve --change <id> --assumption <A-ID> --by <承認者> [--date <YYYY-MM-DD>]` は、「仮定」の表で ID が一致する行の「承認」に `承認`、「承認者」に承認者、「承認日」に日付を書く SHALL。上書き・列がない表・値と日付の扱いは、確認事項の回答を書くときと同じとする SHALL。

Source: REQ-203

#### Scenario: 仮定を承認する
- **WHEN** 承認が空の A-01 に `loomake trace approve --change c1 --assumption A-01 --by PM --date 2026-10-24` を実行する
- **THEN** A-01 の行の承認が `承認`、承認者が `PM`、承認日が `2026-10-24` になり、そのあとのspec-onlyの案内とdoneの不足/要判断理由にA-01の未承認が残らない
