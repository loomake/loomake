## MODIFIED Requirements

### Requirement: 確認事項の回答を書く
`loomake trace answer --change <id> --question <Q-ID> --answer <回答> --by <回答者> [--date <YYYY-MM-DD>]` は、change の trace.md の「確認事項」の表で ID が一致する行の「回答」に回答を、「回答者」に回答者を、「回答日」に日付（省くとその日の日付）を書き、ほかの行と表の外は変えない SHALL。表に回答者・回答日の列がないときは、回答だけを書き、列がないことを表示する SHALL。値の `|` は `\|` として書く SHALL。ID の行がないとき、回答がすでにあるとき、値に改行を含むとき、日付の形が違うときは、ファイルを変えずに使い方の誤り（終了コード 2）とする SHALL。書いたあとは、書いた行と、仕様ゲートで確かめるよう案内を表示して終了コード 0 を返す SHALL。

Source: REQ-202

#### Scenario: 回答を書く
- **WHEN** 回答が空の Q-01 に `loomake trace answer --change c1 --question Q-01 --answer "5 回" --by 担当者 --date 2026-10-24` を実行する
- **THEN** Q-01 の行の回答が `5 回`、回答者が `担当者`、回答日が `2026-10-24` になり、ほかの行は変わらず、終了コードは 0 である

#### Scenario: すでに回答がある
- **WHEN** 回答がある Q-01 に `loomake trace answer` を実行する
- **THEN** trace.md は変わらず、すでに回答があることが表示され、終了コードは 2 である

#### Scenario: ID がない
- **WHEN** 確認事項の表にない Q-09 を指定する
- **THEN** trace.md は変わらず、終了コードは 2 である

#### Scenario: 列がない古い表
- **WHEN** 回答者・回答日の列がない確認事項の表で `loomake trace answer` を実行する
- **THEN** 回答だけが書かれ、回答者・回答日の列がないことが表示される
