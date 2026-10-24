## Purpose

Scenarioと試験の対応をレビューし、候補や古い根拠を検証済みと扱わないためのリポジトリ品質確認を定める。

## ADDED Requirements

### Requirement: Scenarioの一覧と同一性
現行仕様とarchive以外の進行中の差分仕様から、コードブロックを除いて全Scenarioを一覧化する SHALL。ファイル、Requirement名、Scenario名、Source、現在の行番号と内容のハッシュを持ち、名前が同じでも別Requirementや別文書のScenarioを混同しない SHALL。Sourceなし、重複する同一性、閉じていないコードブロックなどで一覧の意味が不明になる場合はエラーにする SHALL。

差分仕様の `## REMOVED Requirements` に属する削除指示はScenarioの一覧から除外し、Scenarioがなくてもエラーにしない SHALL。削除指示だけの文書は空の一覧として扱う SHALL。通常仕様とADDED・MODIFIED Requirementsでは、ScenarioがないRequirementや、Requirementに属さないScenarioを引き続き拒否する SHALL。コードブロック外の節を識別し、既存のIDと内容ハッシュの計算方法を維持する SHALL。

Source: REQ-188

#### Scenario: 同名とコードブロック
- **WHEN** 別Requirementの同名Scenarioと、コード例内のScenarioがある
- **THEN** 実際のScenarioだけを別の行として一覧にする

#### Scenario: 内容が変わる
- **WHEN** Requirementの規則かScenarioの内容が変わる
- **THEN** 同じ名前でもレビュー済みの古いハッシュを認めない

#### Scenario: 削除と追加が同じ文書にある
- **WHEN** Scenarioを持たない削除指示と、Scenarioを持つ追加または変更の要件が同じ差分仕様にある
- **THEN** 削除指示は除外し、追加・変更のScenarioを元のIDと内容ハッシュの規則で一覧にする

#### Scenario: 削除指示だけの文書
- **WHEN** 差分仕様にREMOVED Requirementsの削除指示だけがある
- **THEN** Scenarioがないというエラーにせず、空の一覧を返す

#### Scenario: 通常の要件にScenarioがない
- **WHEN** 通常仕様またはADDED・MODIFIED Requirementsの要件にScenarioがない
- **THEN** 削除指示と混同せず、従来どおりエラーにする

### Requirement: 対応のレビューと成功の根拠
REQ-IDが一致する試験は対応候補とし、その一致だけでは確認済みにしない SHALL。確認済みの対応には、Scenarioの内容のハッシュ、対応理由、テストファイルと名前の選択条件、テストソースのハッシュを持つ SHALL。選ばれた試験が実行結果にあり、すべて成功し、必要なSourceのIDも対応する場合だけ根拠が有効とする SHALL。選択が空、失敗・skip・todo、古い仕様・テスト、存在しない参照を確認済みとしない SHALL。

Source: REQ-189

#### Scenario: IDだけがある
- **WHEN** 成功した試験に同じREQ-IDがあるが、対応のレビューがない
- **THEN** 候補として示し、未確認にする

#### Scenario: 選んだ試験に失敗や未実行がある
- **WHEN** 選択に一致する試験の一部が失敗またはskipである
- **THEN** 成功した一部だけでScenarioを確認済みにしない

### Requirement: 不足と更新の報告
確認済み・未確認・根拠が無効・別Scenarioで置き換え済みを区別し、全件数とファイル・行番号・理由・対応試験をJSONとMarkdownへ出す SHALL。置き換えは同じ一覧の確認済みScenarioへの明示した参照と理由があり、循環しない場合だけ有効とする SHALL。既存表の未知の参照や重複も報告する SHALL。不足や無効があれば終了コード1とし、全件が有効なら0にする SHALL。既存のverifyの合否や品質設定を緩めず、実際の接続・別OSの検証や試験内容の十分さまで自動で保証しない SHALL。

Source: REQ-190

#### Scenario: 未確認が残る
- **WHEN** 対応のレビューが未入力のScenarioがある
- **THEN** 一覧へ残し、監査は終了コード1で不足を示す

#### Scenario: 置き換えが循環する
- **WHEN** 置き換えの参照が循環するか存在しない
- **THEN** 根拠が無効であることを示す
