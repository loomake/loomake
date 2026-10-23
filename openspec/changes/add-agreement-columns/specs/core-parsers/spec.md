## MODIFIED Requirements

### Requirement: trace.md の 3 つの表の読み取り
core は trace.md の「要件台帳」「確認事項」「仮定」の 3 つの表を読み、型付きのオブジェクトとして返す SHALL。確認事項には「回答者」「回答日」を、仮定には「承認者」「承認日」を含めて返す SHALL。表にその列がないときは、空の文字列として返し、エラーにしない SHALL。

Source: REQ-011, REQ-077, REQ-078

#### Scenario: 3 つの表が読み取れる
- **WHEN** 3 つの表を持つ trace.md のテキストを `parseTrace` に渡す
- **THEN** 台帳・確認事項・仮定が列名をキーにした型付きの配列として返る

#### Scenario: 表が欠けている
- **WHEN** 「要件台帳」の表が無い trace.md のテキストを渡す
- **THEN** 空の台帳が返り、エラーに「要件台帳」の表が無いことが含まれる

#### Scenario: 行末が CRLF の trace.md
- **WHEN** 行末を CRLF にした trace.md のテキストを渡す
- **THEN** 行末が LF の同じ trace.md と同じ台帳・確認事項・仮定が返り、値の末尾に `\r` が残らない

#### Scenario: 合意の列を読む
- **WHEN** 回答者が「顧客 PM」、回答日が 2026-10-23 の確認事項と、承認者が「開発リーダー」、承認日が 2026-10-23 の仮定を持つ trace.md を渡す
- **THEN** 確認事項の `回答者`・`回答日` と、仮定の `承認者`・`承認日` に、その値が入る

#### Scenario: 合意の列のない古い trace.md
- **WHEN** 回答者・回答日・承認者・承認日の列がない trace.md を渡す
- **THEN** エラーなく読め、その 4 つの値は空の文字列である

### Requirement: trace.md のテンプレート生成
core は trace.md の空のテンプレートを生成する関数を提供する SHALL。テンプレートの確認事項の表は「回答者」「回答日」の列を、仮定の表は「承認者」「承認日」の列を、それぞれ末尾に持つ SHALL。kit が配る trace.md の雛形も同じ列を持つ SHALL。

Source: REQ-017, REQ-077, REQ-078

#### Scenario: 生成したテンプレートを読める
- **WHEN** `createTraceTemplate({ changeId: "add-x" })` の結果を `parseTrace` に渡す
- **THEN** エラーなく読み取れ、台帳・確認事項・仮定が空である

#### Scenario: テンプレートに合意の列がある
- **WHEN** `createTraceTemplate` の結果と、kit が配る trace.md の雛形を読む
- **THEN** どちらも、確認事項の表の見出しが「回答」「回答者」「回答日」で終わり、仮定の表の見出しが「承認」「承認者」「承認日」で終わる
