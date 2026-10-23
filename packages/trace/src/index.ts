// @loomake/trace：証拠の記録と検収レポート
export { runRecord, EVIDENCE_DIR, EVIDENCE_SCHEMA_VERSION } from './record.js';
export type { Evidence, RecordOptions } from './record.js';
export { runReport, buildReport, formatReportMarkdown, REPORT_SCHEMA_VERSION } from './report.js';
export type { Report, ReportRow, ReportFormat, ReportOptions } from './report.js';
