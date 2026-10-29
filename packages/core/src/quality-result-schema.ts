import { z } from 'zod';

/** 個別の品質判定と CI verdict で共有する4値（REQ-305）。 */
export const qualityResultSchema = z.enum(['PASS', 'FAIL', 'INSUFFICIENT_EVIDENCE', 'NOT_APPLICABLE']);
