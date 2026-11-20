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

export { summaryProblem } from './summary.js';
export type { EvidenceSummary, SummaryArtifact, SummaryGap } from '@loomake/core';
export { parseDuration, parseEffortOption, parseCost } from './effort-input.js';
export { runEffortRecord } from './effort-record.js';
export type { EffortRecordOptions } from './effort-record.js';
export { runReuse } from './reuse.js';
export type { ReuseOptions, ReuseResult, ReuseOutcome, ReuseReason, ReuseReasonCode } from './reuse.js';
export { REUSE_RECORD_VERSION, reuseRecordProblem } from './reuse-record.js';
export type { ReuseRecord } from './reuse-record.js';
