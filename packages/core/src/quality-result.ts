import type { z } from 'zod';
import type { qualityResultSchema } from './quality-result-schema.js';

/** 個別の品質判定と CI verdict で共有する4値。 */
export type QualityResult = z.infer<typeof qualityResultSchema>;

/** 品質判定の4値スキーマを必要なときだけ読む。 */
export function loadQualityResultSchema() {
  return import('./quality-result-schema.js');
}
