import type { z } from 'zod';
import type { evidenceSummarySchema, summaryArtifactSchema, summaryGapSchema } from './summary-schemas.js';

/** Evidence 2 の任意拡張の版。旧 Evidence 自体の版とは別に管理する。 */
export const SUMMARY_VERSION = 1;
export type EvidenceSummary = z.output<typeof evidenceSummarySchema>;
export type SummaryArtifact = z.output<typeof summaryArtifactSchema>;
export type SummaryGap = z.output<typeof summaryGapSchema>;
/** core の通常入口では Zod を読み込まない（REQ-460）。 */
export const loadSummarySchemas = () => import('./summary-schemas.js');
