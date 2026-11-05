# @loomake/core

[loomake](https://www.npmjs.com/package/loomake) の内部用パッケージ。trace.md・spec.md・tasks.md・テストレポートの読み取りと、verify の結果の JSON スキーマ。

直接は使わず、CLI の `loomake` を使う。版が `0.y.z` のあいだは、API が予告なく変わることがある。

詳しくは [GitHub のリポジトリ](https://github.com/loomake/loomake)を見る。

## Markdown 解析結果のスキーマ

`parseTrace`・`parseSpec`・`parseTasks` は従来どおり同期関数で、解析した値とエラーを返す。構造を別の場所で検証するときは `await loadParserSchemas()` で Zod スキーマを読み、各パーサの `.value` を対応するスキーマへ渡す。意味検証は各パーサが行う。たとえば、不正な台帳状態も文字列のまま値に残り、解析エラーで位置と理由が分かる。

| 公開定数 | 対象スキーマ | 初版 |
|---|---|---|
| `TRACE_SCHEMA_VERSION` | `traceSchema` | `1.0.0` |
| `SPEC_SCHEMA_VERSION` | `specSchema` | `1.0.0` |
| `TASKS_SCHEMA_VERSION` | `tasksSchema` | `1.0.0` |

このバージョンは解析結果の構造を表し、パッケージのバージョンとは独立する。Markdown とパーサの返却データにバージョンのフィールドは加えない。スキーマは未知フィールドを受け付け、その値を保持する。

JSON Schema は `@loomake/core/schema/trace.schema.json`・`spec.schema.json`・`tasks.schema.json` から読める。いずれも `.value` の構造を記述する。JSON Schema に独自のバージョン annotation は付けず、上の公開定数で対象スキーマのバージョンを確認する。

## quality-report の初期契約

`QUALITY_REPORT_SCHEMA_VERSION` は数値の `1`。`await loadQualityReportSchema()` で `qualityReportSchema` を読み、`{ "version": 1 }` を解析できる。公開型 `QualityReport` はこのスキーマから導出する。`version` の欠落や文字列の `"1"` は拒否し、既定値で補わない。未知の項目は入れ子も含めて保持する。

この契約はスキーマだけを提供する。評価や quality-report.json の生成は含めず、既存のリリースレポートの `Report` と `schemaVersion: 2` も変更しない。

JSON Schema は `@loomake/core/schema/quality-report.schema.json` から取得できる。Zod と JSON Schema は同じ最小入力を受け付け、版の欠落を拒否する。

## 未知キーの保持

公開 loader から取得した verify・Markdown 解析結果・quality.yaml・quality-report・証拠・リリースレポートのスキーマは、未知の own property `__proto__`・`constructor`・`prototype` を値を変えず保持する。スキーマが検証する入れ子と配列要素にも同じ規則を適用し、入力や共有プロトタイプは変更しない。キーに制約のある record は従来の検証と出力を保つ。

保持処理は各公開スキーマの clone に適用する。利用側で `.clone()`・`.meta({...})`・`.describe('...')`・`.extend({...})` によって作った派生スキーマには、この保持処理は引き継がれない。公開型、既知項目の検証・既定値・診断の設定と配布 JSON Schema は維持する。

## 外部ツールの出力の中立変換

`parseGhChecks(file, text)`・`parseClaudeResult(file, text)`・`parseCodexEvents(file, text)`・`parseBiomeReport(file, text)`・`parsePlaywrightReport(file, text)` は、JSON または JSONL を `ParseResult<ToolObservation | null>` に変換する同期の純粋関数である。I/O や品質判定は行わず、ツールが報告した失敗と入力形式の誤りを区別する。入力形式の誤りでは value が null、errors が安全な ParseError 1 件になる。未知の欄は捨てる。

`ToolObservation` は gh の checks、Claude・Codex の agent-result、Biome の diagnostics と summary、Playwright の tests・stats・errors を表す。終了コードから合否や件数は作らない。Playwright の flaky と期待した失敗は passed にしない。parser は秘密を置換しないため、保存には kit の `collectToolOutput` か既存の置換 API を使う。

受理形式は gh 2.103.0、Codex 0.166.0、Biome 2.6.5、Playwright 1.64.1 の固定版の一次資料を基に定義した。Claude の json の実 fixture は未観測で、2.1.308 の stream-json の result の欄の型と、版を固定していない公式 docs を基に合成した。実ツールや将来の版との互換性を保証するものではない。合成 fixture の出典と限界は `test/tool-output/fixtures/PROVENANCE.md` に記す。

## 人の実作業時間の構造

`EFFORT_SCHEMA_VERSION` は `1`。`await loadEffortSchema()` は `effortRecordSchema`・`effortMinutesSchema`・`effortCostSchema` を読み、`EffortRecord`・`EffortMinutes`・`EffortCost` はそれぞれから導出する。入口の import では Zod を読み込まない。Effort 専用の JSON Schema は追加せず、従来の12本と受入済みの判定要約用 JSON Schema を保持する。

Effort 1 は総計 `totalMinutes` と区分 `minutes` のどちらか一方を持ち、指定しなかった区分は欠測のまま省略する。構造の検査は品質検証の実行や合格を意味しない。記録には trace の同期 API を使う。

## ライセンス

MIT
