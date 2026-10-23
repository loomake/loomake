## MODIFIED Requirements

### Requirement: タスクの読み取り
core は tasks.md から、チェック済み（`- [x]`・`- [X]`）と未チェック（`- [ ]`）のタスクを取り出す SHALL。箇条書きの記号は `-`・`*`・`+` のどれでもよい SHALL。

Source: REQ-014

#### Scenario: チェックの混在
- **WHEN** 完了 2 件・未完了 1 件のタスクを持つ tasks.md を渡す
- **THEN** チェック済み 2 件と未チェック 1 件が、それぞれ行番号つきで返る

#### Scenario: 行末が CRLF の tasks.md
- **WHEN** 行末を CRLF にした tasks.md を渡す
- **THEN** 行末が LF の同じ tasks.md と同じタスクが返り、タスクの文に `\r` が残らない

#### Scenario: `*`・`+` の箇条書き
- **WHEN** `* [ ] 1.1` と `+ [x] 1.2` の行を持つ tasks.md を渡す
- **THEN** 未チェックの 1.1 とチェック済みの 1.2 が返る
