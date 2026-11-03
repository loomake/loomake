## ADDED Requirements

### Requirement: CI診断metadata v1の中立変換
coreは取得済みJSON本文をparseCiTestMetadata(file,text)でCiTestMetadataV1へ変換してParseResultで公開するSHALL。schemaVersionは数値1、runUrl/runId/runAttempt/checkoutSha/os/node/shardは空を許す文字列、testOutcomeはsuccess/failure/not_run、reportStateはvalid/empty/missing/invalid、countsのpassed/failed/pending/skipped/todo/disabledは0以上の安全整数を要求するMUST。不正時は値nullとfile・1始まりのline・messageを返すSHALL。正常時は既知項目を新しい値として返し、未知項目を出力せず入力とprototypeを変えないMUST。取得・時計・合否判定・SHA/URL/環境の真正性や鮮度の照合は行わず、実施日時など入力にない値を補わないMUST。

Source: REQ-391

#### Scenario: 実metadataと既定値の変換
- **WHEN** 固定実metadata、または7文字列が空・not_run・missing・全countsが0のmetadataを渡す
- **THEN** 11既知項目が同じ値で返り、errorsは空になる。successや0件を合格へ変換しない

#### Scenario: JSONと版の不正
- **WHEN** 構文不正JSON、null、配列、またはschemaVersionが欠落・2・文字列1の本文を渡す
- **THEN** 値nullとfile・正のline・日本語messageを返す。JSONの行・位置の診断が得られれば対応するline、得られなければ1とする

#### Scenario: 必須文字列と列挙の不正
- **WHEN** 7文字列のいずれかが欠落・非文字列、またはtestOutcome/reportStateが欠落・未知値の本文を渡す
- **THEN** 値nullと解析エラーを返す。SHA・URL等の文字列の実在性は確かめない

#### Scenario: countsの境界
- **WHEN** countsが欠落・非object、6キーの欠落、負数・小数・数値でない値・無限大・安全整数上限超過を含む本文を渡す
- **THEN** 値nullと解析エラーを返す。0と安全整数上限は同じ値で受け付ける

#### Scenario: 未知項目と公開入口
- **WHEN** 最上位/countsに__proto__を含む未知項目がある本文を公開入口から変換し、公開consumerを型検査する
- **THEN** 既知項目だけが返り、prototypeと入力を変えず、公開関数と型が利用できる
