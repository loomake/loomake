import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { loadQualityReportSchema, QUALITY_REPORT_SCHEMA_VERSION, type QualityReport } from '../src/index.js';

const { qualityReportSchema } = await loadQualityReportSchema();

describe('quality-report の初期スキーマ', () => {
  it('[REQ-301] 初版の定数と遅延ロードを公開する', async () => {
    expect(QUALITY_REPORT_SCHEMA_VERSION).toBe(1);
    const loading = loadQualityReportSchema();
    expect(loading).toBeInstanceOf(Promise);
    expect((await loading).qualityReportSchema).toBe(qualityReportSchema);
  });

  it('[REQ-301] version:1 だけで受け付け、ほかの項目を補わない', () => {
    expect(qualityReportSchema.parse({ version: 1 })).toEqual({ version: 1 });
  });

  it('[REQ-301] 未知の項目と入れ子の値を変更せず保持する', () => {
    const input = { version: 1, extra: { status: 'unmeasured', values: [1, null], nested: { flag: false } } };
    expect(qualityReportSchema.parse(input)).toEqual(input);
  });

  it('[REQ-301] 版を省いた入力を既定値で補完せず拒否する', () => {
    for (const input of [{}, { version: undefined }, { schemaVersion: 2 }]) {
      expect(qualityReportSchema.safeParse(input).success).toBe(false);
    }
  });

  it('[REQ-301] 版が数値の1以外なら拒否する', () => {
    for (const version of ['1', 0, 2, -1, 1.5, null, true]) {
      expect(qualityReportSchema.safeParse({ version }).success, JSON.stringify(version)).toBe(false);
    }
  });

  it('[REQ-301] オブジェクト以外を拒否する', () => {
    for (const input of [undefined, null, [], 1, 'text', true]) {
      expect(qualityReportSchema.safeParse(input).success).toBe(false);
    }
  });

  it('[REQ-301] 公開型と版の型をスキーマから導出する', () => {
    expectTypeOf<QualityReport>().toEqualTypeOf<z.infer<typeof qualityReportSchema>>();
    expectTypeOf<QualityReport['version']>().toEqualTypeOf<1>();
  });
});
