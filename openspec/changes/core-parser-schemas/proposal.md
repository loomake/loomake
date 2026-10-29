# core-parser-schemas

## Why

Issue #60 は、trace.md・spec.md・tasks.md の既存の型を Zod スキーマから導出し、JSON Schema を公開することを求めている。先行 change `core-zod-verify-result` では REQ-277 を後続へ分けており、スキーマバージョンを core の定数に置く方針は Issue の決定コメントで承認されている。

## What Changes

- 3 形式の解析結果と行の公開型を Zod から導出する。
- 既存のパーサ API・戻り値・意味検証を保ち、スキーマを遅延ロードする公開関数と初版 `1.0.0` の定数を追加する。
- 解析結果の JSON Schema を生成し、配布物の exports で公開する。生成差分は既存の CI のテストで検出する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `core-parsers`: trace・spec・tasks の解析結果の Zod スキーマ、導出型、スキーマバージョン定数、JSON Schema の公開。

## Non-goals

quality.yaml・verify JSON の変更、quality-report・証拠・レポートの移行は含めない。Markdown の書式、同期パーサの戻り値、意味検証、品質設定、性能閾値は変更しない。

## Impact

`packages/core/src/` の型定義と公開入口、JSON Schema 生成、公開 exports、対応するテストと利用案内に影響する。実行時依存は既存の `zod` だけとし、kit・trace・runner・CLI の利用側が受け取るデータの形は維持する。
