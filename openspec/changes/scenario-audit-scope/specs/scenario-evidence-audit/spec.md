## MODIFIED Requirements

### Requirement: Scenarioの一覧と同一性
現行仕様（`openspec/specs/`）から、コードブロックを除いて全Scenarioを一覧化する SHALL。ファイル、Requirement名、Scenario名、Source、現在の行番号と内容のハッシュを持ち、名前が同じでも別Requirementや別文書のScenarioを混同しない SHALL。Sourceなし、重複する同一性、閉じていないコードブロックなどで一覧の意味が不明になる場合はエラーにする SHALL。archive以外の進行中のchange（`openspec/changes/<id>/specs/`）のScenarioは一覧に含めず、changeごとの件数を「未着手」として数える SHALL。進行中のchangeの差分仕様を読めない場合は、エラーにせず読めなかったファイルとして報告する SHALL。

Source: REQ-188

#### Scenario: 同名とコードブロック
- **WHEN** 別Requirementの同名Scenarioと、コード例内のScenarioがある
- **THEN** 実際のScenarioだけを別の行として一覧にする

#### Scenario: 内容が変わる
- **WHEN** Requirementの規則かScenarioの内容が変わる
- **THEN** 同じ名前でもレビュー済みの古いハッシュを認めない

#### Scenario: 進行中のchangeのScenario
- **WHEN** 現行仕様のほかに、archiveしていないchangeの差分仕様にScenarioがある
- **THEN** changeのScenarioは一覧に含めず、changeごとの未着手の件数として数える

### Requirement: 対応のレビューと成功の根拠
REQ-IDが一致する試験は対応候補とし、その一致だけでは確認済みにしない SHALL。確認済みの対応には、Scenarioの内容のハッシュ、対応理由、テストファイルと名前の選択条件、試験のハッシュを持つ SHALL。試験のハッシュは、選択に一致した各試験の本文ブロック（`it`・`test` の呼び出しの先頭から対応する閉じ括弧まで。`it.each` などの修飾と表を含む）を元の順に連結したもののハッシュとし、`hashScope: "block"` で示す SHALL。本文ブロックは、試験名の文字列リテラル（テンプレート文字列の式と `%s`・`$name` などの置換は任意の文字列とみなす）が実行結果の完全な試験名の末尾に一致するブロックとし、同じ名前のブロックが複数あればすべてを含める SHALL。`hashScope` のない旧形式の対応は、テストファイル全体のハッシュで照合する SHALL。選ばれた試験が実行結果にあり、すべて成功し、本文ブロックのハッシュが一致し、必要なSourceのIDも対応する場合だけ根拠が有効とする SHALL。選択が空、失敗・skip・todo、古い仕様・テスト、存在しない参照、本文ブロックを特定できない試験を確認済みとしない SHALL。

Source: REQ-189

#### Scenario: IDだけがある
- **WHEN** 成功した試験に同じREQ-IDがあるが、対応のレビューがない
- **THEN** 候補として示し、未確認にする

#### Scenario: 選んだ試験に失敗や未実行がある
- **WHEN** 選択に一致する試験の一部が失敗またはskipである
- **THEN** 成功した一部だけでScenarioを確認済みにしない

#### Scenario: 同じファイルの別の試験が変わる
- **WHEN** 本文ブロックのハッシュで記録した対応があり、同じテストファイルの別の試験だけが追加・変更される
- **THEN** 対応は有効のまま残る

#### Scenario: 選んだ試験の本文が変わる
- **WHEN** 本文ブロックのハッシュで記録した対応があり、選んだ試験の本文か `it.each` の表が変わる
- **THEN** 根拠を無効にする

#### Scenario: 本文ブロックを特定できない
- **WHEN** 実行した試験の名前に一致するブロックがないか、ブロックの括弧が閉じていない
- **THEN** 根拠を無効にする

### Requirement: 不足と更新の報告
確認済み・未確認・根拠が無効・別Scenarioで置き換え済みを区別し、全件数とファイル・行番号・理由・対応試験をJSONとMarkdownへ出す SHALL。進行中のchangeの未着手の件数をchangeごとに同じJSONとMarkdownへ出す SHALL。置き換えは同じ一覧の確認済みScenarioへの明示した参照と理由があり、循環しない場合だけ有効とする SHALL。既存表の未知の参照や重複も報告する SHALL。未着手のScenarioへのレビューは未知の参照としない SHALL。不足や無効があれば終了コード1とし、全件が有効なら0にする SHALL。未着手の件数と、進行中のchangeの差分仕様を読めないことは終了コードに含めない SHALL。既存のverifyの合否や品質設定を緩めず、実際の接続・別OSの検証や試験内容の十分さまで自動で保証しない SHALL。

Source: REQ-190

#### Scenario: 未確認が残る
- **WHEN** 対応のレビューが未入力のScenarioがある
- **THEN** 一覧へ残し、監査は終了コード1で不足を示す

#### Scenario: 置き換えが循環する
- **WHEN** 置き換えの参照が循環するか存在しない
- **THEN** 根拠が無効であることを示す

#### Scenario: 進行中のchangeだけにレビューのないScenarioがある
- **WHEN** 現行仕様の全Scenarioが有効で、進行中のchangeにレビューのないScenarioがある
- **THEN** 未着手の件数をchangeごとに示し、監査は終了コード0になる

## ADDED Requirements

### Requirement: 旧形式の対応の移行
`node scripts/scenario-audit.mjs --migrate` は、レビュー表の旧形式（`hashScope` のない）試験の選択条件を、本文ブロックのハッシュと `hashScope: "block"` に書き換える SHALL。書き換えるのは、選んだ試験の本文ブロックが記録時から変わっていないと確かめられた選択条件だけとする SHALL。現在のテストファイル全体のハッシュが記録と一致するか、gitの履歴で記録と同じハッシュの版を見つけ、その版の本文ブロックが現在と一致する場合に、変わっていないとみなす SHALL。試験が実行結果にない、ファイルがない、履歴に版がない、本文ブロックを特定できない、本文ブロックが変わった選択条件は旧形式のまま残す SHALL。`--dry-run` を付けるとレビュー表を書き換えず、理由ごとの件数だけを出す SHALL。`hashScope: "block"` の選択条件は変えない SHALL。

Source: REQ-346

#### Scenario: ファイルの別の箇所だけが変わった旧形式
- **WHEN** 旧形式の対応のテストファイルが記録後に変わったが、gitの履歴にある記録時の版と現在で、選んだ試験の本文ブロックが同じである
- **THEN** 選択条件を本文ブロックのハッシュと `hashScope: "block"` に書き換える

#### Scenario: 選んだ試験の本文が変わった旧形式
- **WHEN** 旧形式の対応で、記録時の版と現在の本文ブロックが異なるか、記録時の版が履歴にない
- **THEN** 選択条件を旧形式のまま残し、理由ごとの件数に数える

#### Scenario: 件数だけを確かめる
- **WHEN** `--migrate --dry-run` で実行する
- **THEN** レビュー表を書き換えず、書き換える件数と残す件数を理由ごとに出す
