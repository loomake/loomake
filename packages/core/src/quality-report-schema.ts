import { z } from 'zod';
import { QUALITY_REPORT_SCHEMA_VERSION } from './quality-report.js';

export const qualityReportSchema = z
  .looseObject({ version: z.literal(QUALITY_REPORT_SCHEMA_VERSION) })
  .meta({
    $id: 'https://loomake.dev/schema/quality-report.schema.json',
    title: 'Loomake quality report',
    description: 'quality-report の初期契約。version のみ必須とし、追加項目は保持する。',
  });
