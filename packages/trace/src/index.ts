// @loomake/trace：証拠の記録とリリースレポート
export { runRecord, EVIDENCE_DIR, EVIDENCE_SCHEMA_VERSION } from './record.js';
export type { Evidence, RecordOptions } from './record.js';
export { LEGACY_EVIDENCE_SCHEMA_VERSION, EVIDENCE_V2_SCHEMA_VERSION } from '@loomake/core';
export type { LegacyEvidence, EvidenceV2 } from '@loomake/core';
export { runReport, buildReport, formatReportMarkdown, REPORT_SCHEMA_VERSION, SCOPE_NOTE } from './report.js';
export type { EvidenceDocument } from './documents.js';
export type { Report, ReportRow, ReportFormat, ReportOptions } from './report.js';

export { evidenceProblem } from './evidence.js';
export { readDocuments, changedDocuments } from './documents.js';
export { runAgreement } from './agreement.js';
export type { AgreementOptions } from './agreement.js';
