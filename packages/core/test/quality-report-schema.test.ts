import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

  it('[REQ-301] 配布JSONとZodは同じ入力を受理・拒否し、値を補完しない', () => {
    const schema = JSON.parse(readFileSync(join(import.meta.dirname, '../schema/quality-report.schema.json'), 'utf8'));
    const validate = new Ajv2020({ strict: false }).compile(schema);
    expect(schema.required).toEqual(['version']);
    expect(schema.properties.version).toEqual({ type: 'number', const: 1 });
    const inputs = [
      { value: { version: 1 }, accepted: true },
      { value: { version: 1, extra: { status: 'unmeasured', values: [1, null] } }, accepted: true },
      ...[{}, { version: '1' }, { version: 0 }, { version: 2 }, { version: null }, { version: true }, { schemaVersion: 2 }, null, [], 1, 'text', true]
        .map((value) => ({ value, accepted: false })),
    ];
    for (const { value, accepted } of inputs) {
      const original = JSON.parse(JSON.stringify(value));
      const parsed = qualityReportSchema.safeParse(value);
      expect(parsed.success, JSON.stringify(value)).toBe(accepted);
      expect(validate(value), JSON.stringify(value)).toBe(accepted);
      expect(value).toEqual(original);
      if (parsed.success) expect(parsed.data).toEqual(original);
    }
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8'));
    for (const exports of [pkg.exports, pkg.publishConfig.exports]) {
      expect(exports['./schema/quality-report.schema.json']).toBe('./schema/quality-report.schema.json');
    }
  });
});
