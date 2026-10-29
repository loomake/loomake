import type { z } from 'zod';
import type { evidenceDocumentSchema, evidenceSchema, reportRowSchema, reportSchema } from './trace-schemas.js';

/** 証拠の記録の形式の版。適合性の検査は trace が行う。 */
export const EVIDENCE_SCHEMA_VERSION = 1;
/** リリースレポートの JSON の版。 */
export const REPORT_SCHEMA_VERSION = 2;

/** 1 回分の証拠の記録。古い記録の documents は省略される。 */
export type Evidence = z.output<typeof evidenceSchema>;
export type EvidenceDocument = z.output<typeof evidenceDocumentSchema>;
export type Report = z.output<typeof reportSchema>;
export type ReportRow = z.output<typeof reportRowSchema>;

/** 構造スキーマを遅延読み込みする。入口の読み込みでは zod を読まない。 */
export const loadTraceSchemas = () => import('./trace-schemas.js');
