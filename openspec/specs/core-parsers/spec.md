# core-parsers Specification

## Purpose
`@loomake/core` が、trace.md・spec.md・tasks.md・テストランナーの JSON レポートをどう読み、verify の結果をどの形で表すかを定める。kit・CLI など後続のツールは、この読み方と JSON スキーマを共有する。

## Requirements

### Requirement: trace.md の 3 つの表の読み取り
core は trace.md の「要件台帳」「確認事項」「仮定」の 3 つの表を読み、型付きのオブジェクトとして返す SHALL。確認事項には「回答者」「回答日」を、仮定には「承認者」「承認日」を含めて返す SHALL。この 4 つの列が表にないときは、空の文字列として返し、エラーにしない SHALL。それ以外の列が表にないときは、その表と列の名前を示す解析エラーを返す SHALL。

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

#### Scenario: 必須の列がない
- **WHEN** 確認事項の表の「ブロッキング」の列名を「ブロッキング?」にした trace.md を渡す
- **THEN** エラーに、「確認事項」の表に「ブロッキング」の列がないことが含まれる

### Requirement: 台帳の状態値の検査
core は要件台帳の「状態」が 反映済・確認待ち・範囲外・既存仕様で充足 のいずれでもない行を、エラーとして報告する SHALL。

Source: REQ-012

#### Scenario: 不正な状態値
- **WHEN** 「状態」が「対応中」の行を含む trace.md を渡す
- **THEN** その行の ID と値「対応中」を含むエラーが報告される

#### Scenario: 4 つの状態値
- **WHEN** 状態が 反映済・確認待ち・範囲外・既存仕様で充足 の行だけを含む trace.md を渡す
- **THEN** 状態値に関するエラーは報告されない

### Requirement: 差分仕様の読み取り
core は OpenSpec の差分仕様（spec.md）から、Requirement ごとに 操作（ADDED・MODIFIED・REMOVED・RENAMED）、名前、Source の要件 ID、Scenario 数を取り出す SHALL。OpenSpec 1.14 以上の書式を読める MUST。

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

### Requirement: タスクの読み取り
core は tasks.md から、チェック済み（`- [x]`・`- [X]`）と未チェック（`- [ ]`）のタスクを取り出す SHALL。

Source: REQ-014

#### Scenario: チェックの混在
- **WHEN** 完了 2 件・未完了 1 件のタスクを持つ tasks.md を渡す
- **THEN** チェック済み 2 件と未チェック 1 件が、それぞれ行番号つきで返る

#### Scenario: 行末が CRLF の tasks.md
- **WHEN** 行末を CRLF にした tasks.md を渡す
- **THEN** 行末が LF の同じ tasks.md と同じタスクが返り、タスクの文に `\r` が残らない

### Requirement: テストが対象とする要件 ID の抽出
core はテストランナーの JSON レポートから、成功したテストの名前にある `[REQ-xxx]` 形式の要件 ID を、テストファイルごとに取り出す SHALL。skip・todo のテストと、失敗したテストは数えない MUST。

Source: REQ-015

#### Scenario: 通常のテスト
- **WHEN** `status` が `passed` で、名前が `[REQ-012][REQ-013] ...` のテストを含むレポートを渡す
- **THEN** そのテストファイルについて `REQ-012` と `REQ-013` が返る

#### Scenario: skip と todo
- **WHEN** 名前に `[REQ-020]`・`[REQ-021]`・`[REQ-022]` を持つテストの `status` が、それぞれ `skipped`・`todo`・`pending` であるレポートを渡す
- **THEN** 要件 ID は返らない

#### Scenario: 失敗したテスト
- **WHEN** 名前に `[REQ-023]` を持つテストの `status` が `failed` であるレポートを渡す
- **THEN** 要件 ID は返らない

#### Scenario: describe の名前にある要件 ID
- **WHEN** describe の名前が `[REQ-024] ...` で、その中のテストの `status` が `passed` であるレポートを渡す
- **THEN** そのテストファイルについて `REQ-024` が返る

#### Scenario: 読めないレポート
- **WHEN** JSON として読めないテキストを渡す
- **THEN** 空の結果と、ファイル名を含むエラーが返る

### Requirement: verify 結果の JSON スキーマ
core は verify 結果の JSON スキーマを公開し、スキーマに `schemaVersion` を含める SHALL。スキーマに破壊的変更を入れるときは `schemaVersion` のメジャー番号を上げる MUST。

Source: REQ-016, REQ-053

#### Scenario: スキーマが公開されている
- **WHEN** `@loomake/core` のスキーマを読む
- **THEN** `schemaVersion` が必須プロパティとして定義されている

#### Scenario: 破壊的変更でメジャー番号が上がる
- **WHEN** スキーマの必須プロパティを削除・改名する変更を加える
- **THEN** スキーマの `schemaVersion` のメジャー番号が前の版より大きい

### Requirement: trace.md のテンプレート生成
core は trace.md の空のテンプレートを生成する関数を提供する SHALL。テンプレートの確認事項の表は「回答者」「回答日」の列を、仮定の表は「承認者」「承認日」の列を、それぞれ末尾に持つ SHALL。kit が配る trace.md の雛形も同じ列を持つ SHALL。

Source: REQ-017, REQ-077, REQ-078

#### Scenario: 生成したテンプレートを読める
- **WHEN** `createTraceTemplate({ changeId: "add-x" })` の結果を `parseTrace` に渡す
- **THEN** エラーなく読み取れ、台帳・確認事項・仮定が空である

#### Scenario: テンプレートに合意の列がある
- **WHEN** `createTraceTemplate` の結果と、kit が配る trace.md の雛形を読む
- **THEN** どちらも、確認事項の表の見出しが「回答」「回答者」「回答日」で終わり、仮定の表の見出しが「承認」「承認者」「承認日」で終わる

### Requirement: 解析エラーの位置情報
core の解析エラーはファイル名と行番号を含む SHALL。

Source: REQ-018

#### Scenario: 位置情報つきのエラー
- **WHEN** 3 行目に不正な状態値を持つ trace.md を、ファイル名 `trace.md` で渡す
- **THEN** エラーの `file` が `trace.md`、`line` が不正な行の行番号である

### Requirement: 実行時依存ゼロ
`@loomake/core` の `package.json` は、実行時依存（`dependencies`）を持たない SHALL。

Source: REQ-046

#### Scenario: dependencies が空
- **WHEN** `packages/core/package.json` を読む
- **THEN** `dependencies` が存在しないか空である

### Requirement: OpenSpec 書式との互換
Loomake の追加書式（`Source:` 行と trace.md）を含む change は、`openspec validate --strict` を通る SHALL。Loomake は独自の仕様書式を導入しない MUST。

Source: REQ-052, REQ-058

#### Scenario: 追加書式を含む change の検証
- **WHEN** `Source:` 行つきの spec.md と trace.md を持つ change に `openspec validate --strict` を実行する
- **THEN** 終了コード 0 で終わる
