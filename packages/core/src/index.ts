// @loomake/core：trace.md・spec.md・tasks.md・テストのレポートの読み方と、verify 結果の Zod スキーマと型。
// パーサはファイルを読まず、ファイル名とテキストを受け取って結果とエラーを返す
export type { ParseError, ParseResult } from './parse.js';
export { parseTrace, LEDGER_STATES } from './trace.js';
export { setTraceCells } from './trace-edit.js';
export type { EditableTable, TraceEditResult } from './trace-edit.js';
export type { Trace, LedgerRow, QuestionRow, AssumptionRow } from './trace.js';
export { parseSpec } from './spec.js';
export type { SpecOperation, SpecRequirement } from './spec.js';
export { parseTasks } from './tasks.js';
export type { Task } from './tasks.js';
export { TRACE_SCHEMA_VERSION, SPEC_SCHEMA_VERSION, TASKS_SCHEMA_VERSION, loadParserSchemas } from './parser-contracts.js';
export { extractTestRequirements, parseTestReport } from './test-report.js';
export type { TestCase, TestCaseStatus, TestFileResult, TestReport, TestRequirements } from './test-report.js';
export { createTraceTemplate } from './template.js';
export { VERIFY_RESULT_SCHEMA_VERSION, LEGACY_VERIFY_RESULT_SCHEMA_VERSION, VERIFY_RESULT_V2_SCHEMA_VERSION, loadVerifyResultSchemas } from './verify-result.js';
export type { VerifyMode, VerifyCheckResult, VerifyResult, LegacyVerifyResult, LegacyVerifyCheckResult } from './verify-result.js';
export type { VerifyScope, VerifyRunError, VerifyCheckV2, VerifyDecision, VerifyResultV2, VerifyResultV2Ci, VerifyResultV2Local, VerifyResultV2Aborted } from './verify-result.js';
export { QUALITY_SCHEMA_VERSION, loadQualitySchema } from './quality.js';
export type { Quality, QualityInput, QualityMeasure, QualityObjective, QualityProduct, QualityEvidencePolicy } from './quality.js';
export { QUALITY_REPORT_SCHEMA_VERSION, loadQualityReportSchema } from './quality-report.js';
export type { QualityReport } from './quality-report.js';
export { createAgreement } from './agreement.js';
export type { Agreement, RequirementId, LedgerState } from './agreement.js';
export { EVIDENCE_SCHEMA_VERSION, LEGACY_EVIDENCE_SCHEMA_VERSION, EVIDENCE_V2_SCHEMA_VERSION, REPORT_SCHEMA_VERSION, loadTraceSchemas } from './trace-contracts.js';
export type { Evidence, LegacyEvidence, EvidenceV2, EvidenceDocument, Report, ReportRow } from './trace-contracts.js';
export { loadQualityResultSchema } from './quality-result.js';
export type { QualityResult } from './quality-result.js';
