# Design

## Context

背景と対象範囲は proposal.md を参照する。既存のパーサは同期関数で、`ParseResult<T>` の value と errors を返す。trace は列名をキーにした文字列と行番号、spec は `SpecRequirement[]`、tasks は `Task[]` を返す。verify JSON と quality.yaml の Zod は公開入口から遅延ロードしており、CLI の起動時に Zod を静的に読むと REQ-050 の性能制約に影響する。

## Goals / Non-Goals

既存のパーサが作るデータの契約を一か所で定める。スキーマをパーサ内部の追加検証として使ったり、データを正規化したりしない。共通の `ParseResult<T>` や内部の Markdown テーブル型は、今回公開する 3 形式の契約とは分ける。

## Decisions

### スキーマと型の分離

`parser-schemas.ts` に `ledgerRowSchema`・`questionRowSchema`・`assumptionRowSchema`・`traceSchema`・`specOperationSchema`・`specRequirementSchema`・`specSchema`・`taskSchema`・`tasksSchema` を定義する。3 つの既存モジュールは型だけの import と `z.infer` で公開型を導出し、パーサの処理は維持する。行を組み立てる内部ヘルパーの型は公開型へ代入できるように保つ。

`z.looseObject` で未知フィールドを許す。台帳の状態は `string` とし、不正値を返却データに残して errors で診断する現在の振る舞いを維持する。列・ID・日付に新たな正規表現や制約を加えない。`from` は optional、`op` は 4 操作の enum または null とする。パーサに Zod の実行時検証を足す案は、同期 API と起動性能に影響するため採らない。

### バージョンと公開入口

`parser-contracts.ts` は `TRACE_SCHEMA_VERSION`・`SPEC_SCHEMA_VERSION`・`TASKS_SCHEMA_VERSION` を各 `1.0.0` とし、`loadParserSchemas()` で上記モジュールを動的 import する。公開初版の値と定数名、遅延ロードの方針は管理役が合意した技術選択である。バージョンはパッケージのバージョンと独立し、それぞれ traceSchema・specSchema・tasksSchema に対応する。

Issue #60 の Q-03 決定に従い、Markdown や value、ParseResult、生成 JSON Schema に version を足さない。JSON Schema の独自 annotation も不要とする。定数と対象スキーマの対応を core の README に記載する。schemaVersion を持つ verify JSON や version を持つ quality.yaml とは区別する。

### JSON Schema の生成と配布

既存の `CONTRACT_SCHEMAS` に `trace.schema.json`・`spec.schema.json`・`tasks.schema.json` を追加する。trace は value のオブジェクト、spec と tasks は value の配列のスキーマであり、`ParseResult<T>` のラッパーではない。既存と同じ draft-2020-12、入力側の JSON Schema として生成する。通常の exports と publishConfig.exports の両方で公開する。既存の生成差分テストと配布物 smoke の検査を拡張し、新たな CI の手順は設けない。

## Risks / Trade-offs

型の導出で Zod を静的に読み込む危険は、型だけの import と既存の CLI 起動テストで防ぐ。未知フィールドを許す型には index signature が付くため、従来の明示プロパティの型と利用側への代入互換性を型チェックで確認する。

台帳状態を enum に狭めると不正な入力の診断を表せなくなるため、意味検証と構造のスキーマを分ける。未知の Markdown 列は従来どおりパーサの公開結果に投影せず、元の Markdown を編集する処理も変更しない。

## Migration Plan

quality.yaml の先行 PR の head を起点とし、この PR では parser の契約だけを追加する。利用側のデータ移行は不要で、削除によって戻せる追加 API の変更である。レビュー時点で同じ head の検証結果を確認し、Issue #60 は全体の残作業を保持する。
