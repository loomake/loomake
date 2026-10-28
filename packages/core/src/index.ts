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
export { extractTestRequirements } from './test-report.js';
export type { TestRequirements } from './test-report.js';
export { createTraceTemplate } from './template.js';
export { VERIFY_RESULT_SCHEMA_VERSION, verifyResultSchema, verifyCheckResultSchema, verifyModeSchema } from './verify-result.js';
export type { VerifyMode, VerifyCheckResult, VerifyResult } from './verify-result.js';
export { createAgreement, evaluateAgreement } from './agreement.js';
export type { Agreement, AgreementDecision, RequirementId, LedgerState } from './agreement.js';
export { evaluateTestCoverage } from './coverage-policy.js';
export type { TestCoverageDecision } from './coverage-policy.js';
