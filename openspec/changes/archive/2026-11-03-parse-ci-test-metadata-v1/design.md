# Design

## Context
固定writerは11項目を出し、metadata v1には実施日時・runner版・本文hashがない。実artifactのZIP digest一致は完全性だけを示す。

## Goals / Non-Goals
公開の中立変換だけを通常受入し、収集・判定・親の受入は含めない。

## Decisions
- 公開parseCiTestMetadata(file,text)は同期・I/Oなし。CiTestMetadataV1とParseResultをexportし、既存APIは変えない。独立した公開変換とconsumer試験で受け入れる。
- 数値1の版、空を許す7文字列、2列挙、6counts安全整数、未知項目projectionはQ-C003-02=Aの本人回答による。writerの出力例を外部入力の拒否契約と同一視しない。
- JSONの行番号は既存test-report.tsのerrorLineを内部exportして共用する。引用された入力を位置診断と誤認しないよう、末尾のline/columnとat position形式だけを読み、位置が安全整数でない場合や入力の範囲を超える場合は1行目へ戻す。LF/CR/CRLFを保つ。新runtime依存・取得・時計・判定・ログを追加しない。
- 正常入力は既知項目を新規objectへ取り出す。countsも新規にし、__proto__等の未知項目をspreadしない案。原本文の保存経路には触れない。

## Test mapping
| Scenario | 新規試験で確認する範囲 |
|---|---|
| 実例/既定値 | 固定metadata、空7文字列、not_run/missing、全0件、成功に昇格しない |
| JSON/版 | syntax・null・配列、版の欠落/2/文字列1、file/line/message、引用位置の誤認・位置境界・共有3parser・LF/CR/CRLF |
| 文字列/列挙 | 全7キーの欠落/型違い、2列挙の欠落/未知値 |
| counts | object/6キー、0/安全上限の正例、欠落/負/小数/文字列/null/Infinity/上限超過の負例 |
| unknown/public | 最上位/countsの__proto__・未知項目、入力不変、公開consumer |

## Independent review criteria
REQ-391の全5 Scenarioと全sourceを照合する。既存parser・exports・依存・原文保存経路・入力/prototypeを保持し、真正性・鮮度・適格性・合否を保証しない。TEST/PINと設定を変更しない。

## Scope budget
計画実数118行、実装・試験・fixture・consumer・changeset等139行、記録11行でarchive前268行。主仕様への同期26行込み294行を見込む。既存の行番号契約を直す回帰を含め約320行となる見込みを管理役へ報告し、条件や試験を削らず進める承認を得た。

## Risks / Trade-offs
自己申告を保証へ読み替える危険があるため、入力にない値を補わず、取得・結付け・適格性は後続へ明示して残す。
