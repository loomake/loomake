import type { z } from 'zod';
import type { qualityReportSchema } from './quality-report-schema.js';

/** quality-report の初版。既存のリリースレポートの schemaVersion とは独立する。 */
export const QUALITY_REPORT_SCHEMA_VERSION = 1;

export type QualityReport = z.infer<typeof qualityReportSchema>;

/** quality-report の検証に必要なときだけ Zod スキーマを読む（REQ-301）。 */
export function loadQualityReportSchema() {
  return import('./quality-report-schema.js');
}
