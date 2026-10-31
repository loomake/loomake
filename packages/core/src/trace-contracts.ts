import type { z } from 'zod';
import type { evidenceDocumentSchema, evidenceSchema, evidenceV2Schema, legacyEvidenceSchema, reportRowSchema, reportSchema } from './trace-schemas.js';

/** いま書き出す証拠の記録の形式の版（verify 2.0.0 を埋め込む）。適合性の検査は trace が行う（REQ-315）。 */
export const EVIDENCE_SCHEMA_VERSION = 2;
/** 履歴の証拠の版（verify 1.0.0 を埋め込む）。閲覧だけに使う。 */
export const LEGACY_EVIDENCE_SCHEMA_VERSION = 1;
/** verify 2.0.0 を埋め込む証拠の版。 */
export const EVIDENCE_V2_SCHEMA_VERSION = 2;
/** リリースレポートの JSON の版。 */
export const REPORT_SCHEMA_VERSION = 2;

/** いま書き出す 1 回分の証拠の記録（Evidence 2）。古い記録の documents は省略される。 */
export type Evidence = z.output<typeof evidenceSchema>;
export type LegacyEvidence = z.output<typeof legacyEvidenceSchema>;
export type EvidenceV2 = z.output<typeof evidenceV2Schema>;
export type EvidenceDocument = z.output<typeof evidenceDocumentSchema>;
export type Report = z.output<typeof reportSchema>;
export type ReportRow = z.output<typeof reportRowSchema>;

/** 構造スキーマを遅延読み込みする。入口の読み込みでは zod を読まない。 */
export const loadTraceSchemas = () => import('./trace-schemas.js');
