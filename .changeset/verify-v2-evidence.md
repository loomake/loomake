---
"@loomake/core": minor
"@loomake/trace": minor
"loomake": minor
"@loomake/runner": patch
---

証拠の現行の名前を Evidence 2 に切り替える（破壊的変更）。Evidence 1 は履歴の名前で読める。

- `@loomake/core`：`Evidence`・`evidenceSchema`・`EVIDENCE_SCHEMA_VERSION`（2）と `schema/evidence.schema.json` が、verify 2.0.0 を含む Evidence 2 を表す。Evidence 1 は `LegacyEvidence`・`legacyEvidenceSchema`・`LEGACY_EVIDENCE_SCHEMA_VERSION` と `schema/versions/evidence-1.schema.json` で読む。`EvidenceV2`・`evidenceV2Schema`・`EVIDENCE_V2_SCHEMA_VERSION` は Evidence 2 の別名として残る
- `@loomake/trace`：`Evidence` の型は Evidence 2 を表す。`trace report` は、未対応の版・証拠と verify の版の混在・Evidence 2 で `run.status` ごとに必須の欄の欠けを、ファイルと不正な箇所を示して終了コード 2 で止める
- `loomake`：`verify --help` の `--skip-commands` の説明を、実際の動き（レポートを読まずに、その項目を証拠不足にして終了コード 1）に合わせる
- `@loomake/runner`：証拠の型の名前の変更に合わせる（振る舞いは変えない）
