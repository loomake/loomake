import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { loadQualityResultSchema, loadVerifyResultSchemas, VERIFY_RESULT_SCHEMA_VERSION, type QualityResult } from '../src/index.js';
import { renderJsonSchemas } from '../src/json-schema.js';

describe('共有する品質判定の4値', () => {
  it('[REQ-305] 公開 loader は Promise でスキーマを取得し、4値をそのまま返す', async () => {
    const loading = loadQualityResultSchema();
    expect(loading).toBeInstanceOf(Promise);
    const { qualityResultSchema } = await loading;
    for (const result of ['PASS', 'FAIL', 'INSUFFICIENT_EVIDENCE', 'NOT_APPLICABLE']) {
      expect(qualityResultSchema.parse(result)).toBe(result);
    }
    expect((await loadQualityResultSchema()).qualityResultSchema).toBe(qualityResultSchema);
    expectTypeOf<QualityResult>().toEqualTypeOf<z.infer<typeof qualityResultSchema>>();
    expectTypeOf<QualityResult>().toEqualTypeOf<'PASS' | 'FAIL' | 'INSUFFICIENT_EVIDENCE' | 'NOT_APPLICABLE'>();
  });

  it('[REQ-305] 未知の値と文字列以外を拒否する', async () => {
    const { qualityResultSchema } = await loadQualityResultSchema();
    for (const value of ['pass', 'UNKNOWN', '', 0, null, undefined, {}, []]) {
      expect(qualityResultSchema.safeParse(value).success).toBe(false);
    }
  });

  it('[REQ-305] verify 1.0.0 と既存8形式の JSON だけを保持する', async () => {
    expect(VERIFY_RESULT_SCHEMA_VERSION).toBe('1.0.0');
    const { verifyResultSchema } = await loadVerifyResultSchemas();
    const legacy = { schemaVersion: '1.0.0', mode: 'done', change: 'sample', ok: true, results: [] };
    expect(verifyResultSchema.parse(legacy)).toEqual(legacy);
    expect(Object.keys(renderJsonSchemas()).sort()).toEqual(['evidence.schema.json', 'quality-report.schema.json', 'quality.schema.json', 'report.schema.json', 'spec.schema.json', 'tasks.schema.json', 'trace.schema.json', 'verify-result.schema.json']);
  });
});
