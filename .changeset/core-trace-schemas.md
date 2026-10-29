---
'@loomake/core': patch
'@loomake/trace': patch
---

証拠とリリースレポートのデータ構造を core の Zod スキーマに移し、`Evidence`・`EvidenceDocument`・`Report`・`ReportRow` をそこから導出した。`loadTraceSchemas()` と Evidence/Report の JSON Schema を公開する。trace の従来の公開元と同期処理を維持し、number の `schemaVersion`、任意の `documents`、JSON の整形を保持した。
