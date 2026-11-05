## MODIFIED Requirements

### Requirement: trace.md の 3 つの表の読み取り
core は trace.md の「要件台帳」「確認事項」「仮定」の 3 つの表を読み、型付きのオブジェクトとして返す SHALL。確認事項には「回答者」「回答日」を、仮定には「承認者」「承認日」を含めて返す SHALL。この 4 つの列が表にないときは、空の文字列として返し、エラーにしない SHALL。それ以外の列が表にないときは、その表と列の名前を示す解析エラーを返す SHALL。 表の読み取りは最初の表の後の空行で終え、後続の表を含めない SHALL。先頭の BOM を 1 つだけ除いて読む SHALL。

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
- **WHEN** 回答者が「プロダクト責任者」、回答日が 2026-10-23 の確認事項と、承認者が「開発リーダー」、承認日が 2026-10-23 の仮定を持つ trace.md を渡す
- **THEN** 確認事項の `回答者`・`回答日` と、仮定の `承認者`・`承認日` に、その値が入る

#### Scenario: 合意の列のない古い trace.md
- **WHEN** 回答者・回答日・承認者・承認日の列がない trace.md を渡す
- **THEN** エラーなく読め、その 4 つの値は空の文字列である

#### Scenario: 必須の列がない
- **WHEN** 確認事項の表の「ブロッキング」の列名を「ブロッキング?」にした trace.md を渡す
- **THEN** エラーに、「確認事項」の表に「ブロッキング」の列がないことが含まれる

#### Scenario: 空行の後の表
- **WHEN** 最初の表の後に空行と別の表がある
- **THEN** 最初の表の行だけを返す

#### Scenario: 先頭の BOM
- **WHEN** BOM 付きの trace.md を渡す
- **THEN** BOM のない本文と同じ値と行番号を返す

### Requirement: 差分仕様の読み取り
core は OpenSpec の差分仕様（spec.md）から、Requirement ごとに 操作（ADDED・MODIFIED・REMOVED・RENAMED）、名前、Source の要件 ID、Scenario 数を取り出す SHALL。OpenSpec 1.14 以上の書式を読める MUST。 閉じフェンスは開きと同じ記号で長さが以上、後続が空白だけの行に限る SHALL。先頭の BOM を 1 つだけ除き、Source ID は初出順で重複なく返す SHALL。

Source: REQ-013, REQ-051

#### Scenario: ADDED の Requirement
- **WHEN** `## ADDED Requirements` の下に `Source: REQ-001, REQ-002` と 2 つの Scenario を持つ Requirement を含む spec.md を渡す
- **THEN** 操作 `ADDED`、名前、Source `["REQ-001", "REQ-002"]`、Scenario 数 2 が返る

#### Scenario: 4 つの操作
- **WHEN** ADDED・MODIFIED・REMOVED・RENAMED の見出しを持つ spec.md を渡す
- **THEN** 各 Requirement に、属する見出しに対応する操作が付く

#### Scenario: 行末が CRLF の spec.md
- **WHEN** 行末を CRLF にした spec.md を渡す
- **THEN** 行末が LF の同じ spec.md と同じ操作・名前・Source・Scenario 数が返る

#### Scenario: info string のあるフェンス
- **WHEN** コードブロック内に info string 付きのフェンスと Requirement がある
- **THEN** その行では閉じず、内部の Requirement を返さない

#### Scenario: BOM 付きの操作見出し
- **WHEN** 先頭に BOM のある ADDED 見出しを渡す
- **THEN** 操作 ADDED を返す

#### Scenario: Source の重複
- **WHEN** 同じ Requirement の複数の Source 行に同じ ID が繰り返される
- **THEN** 初出順で各 ID を一度だけ返す

## ADDED Requirements

### Requirement: trace の表内 ID の重複
parseTrace は各表の空でない ID の 2 行目以降を解析エラーにする SHALL。file・重複行の 1 始まりの line・表名・ID・最初の行番号を返し、値の行は削除しない SHALL。別の表同士の同じ ID と空の ID は重複エラーにしない SHALL。既存の省略可能な列の扱いを保つ MUST。

Source: REQ-422

#### Scenario: 各表内の重複
- **WHEN** 要件台帳・確認事項・仮定の各表内に同じ ID が複数ある
- **THEN** 各表の 2 行目以降の行番号つきエラーを返し、全行の値を保持する

#### Scenario: 別の表と空の ID
- **WHEN** 別の表に同じ ID があり、空の ID が複数ある
- **THEN** それらを ID 重複エラーにしない

#### Scenario: 仕様ゲート
- **WHEN** 回答済みの質問 ID が重複した trace.md で仕様ゲートを実行する
- **THEN** trace.md の解析で不合格になる
