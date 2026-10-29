## ADDED Requirements

### Requirement: 品質判定の共有4値

core は `PASS`・`FAIL`・`INSUFFICIENT_EVIDENCE`・`NOT_APPLICABLE` のみを受け付ける Zod enum と、そのスキーマから導出した `QualityResult` 型を公開する SHALL。スキーマは `loadQualityResultSchema()` で遅延ロードし、core・kit・CLI の入口から zod を静的に読み込まない MUST。既存の VerifyResult 1.0.0 と8本の公開 JSON Schema を変えない MUST。共有 enum 単独の JSON ファイルは追加しない。

Source: REQ-305

#### Scenario: 4値の読み取り
- **WHEN** 遅延 loader で取得した `qualityResultSchema` に4値をそれぞれ渡す
- **THEN** 値をそのまま返し、それ以外の値・型を拒否する

#### Scenario: 公開型と既存形式
- **WHEN** core の公開型と loader を配布物から利用する
- **THEN** `QualityResult` はスキーマから導出され、既存の verify 形式と8本の JSON は変わらない
