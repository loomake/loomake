## ADDED Requirements

### Requirement: CI診断metadataとテスト本文の中立な組合せ
coreはparseCiTestArtifactでmetadataのfile/textと、reportのfile/textまたはnullを受け、metadataとreportを持つParseResultを公開するSHALL。metadataはparseCiTestMetadata、report本文は既存parseTestReportを使って独立に変換するMUST。不在reportはnullでエラーなし、不正な側はnullとそのfile・1始まりのline・日本語messageつき解析エラーを返し、正常な側の値を保持するSHALL。両側不正なら両方nullと両側のエラーを返すMUST。metadataの申告状態・件数をreportに代入せず、両側の一致・真正性・鮮度・実施充足・合格を認定しないMUST。

Source: REQ-392

#### Scenario: 両側正常とreport不在
- **WHEN** 正常metadataと、正常な空/非空reportまたはnullを渡す
- **THEN** 空のreportも各parserと同じ値になり、不在だけreport=nullが返り、errorsは空で、公開consumerから関数と型を使える

#### Scenario: 片側不正と両側不正
- **WHEN** metadataだけ、reportだけ、または両方がJSON/形の不正を含む
- **THEN** 不正側はnull、正常側はそのparserの値になり、不正側ごとのfile・line・messageが返る

#### Scenario: 申告と本文が一致しない
- **WHEN** metadataがsuccess/valid/全0件で、report本文が失敗・skip・その他status・開始時刻を持つ
- **THEN** 両側を変更せず返し、REQ-319のstatus/REQ対応/開始時刻を維持し、一致や合格を認定しない

#### Scenario: 入力・既存parser・公開APIの保持
- **WHEN** 組の入力をfreezeして変換し、同じreportをparseTestReportにも渡す
- **THEN** 入力を変えずreportは既存結果と一致し、既存exports・REQ-015/319の結果を変えない
