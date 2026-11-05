import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { BODY_RECEIPT_VERSION, loadSummarySchemas } from '../src/index.js';
import { renderSummaryJsonSchemas } from '../src/json-schema.js';
import { receiptFixture } from '../../../tests/fixtures/body-index/fixture.js';

describe('本体参照receiptの独立構造', () => {
  it('[REQ-470] 追加Schemaを遅延公開し既存13Schemaを変更しない', async () => {
    const { bodyReceiptSchema } = await loadSummarySchemas();
    expect(BODY_RECEIPT_VERSION).toBe(1);
    const value = receiptFixture().receipt;
    expect(bodyReceiptSchema.parse(value)).toEqual(value);
    const text = renderSummaryJsonSchemas()['body-receipt-1.schema.json'];
    expect(readFileSync(join(import.meta.dirname, '../schema/summary/body-receipt-1.schema.json'), 'utf8').replace(/\r\n/g, '\n')).toBe(text);
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8'));
    const file = './schema/summary/body-receipt-1.schema.json';
    expect(pkg.exports[file]).toBe(file); expect(pkg.publishConfig.exports[file]).toBe(file);
    const valid = new Ajv2020({ strict: false }).compile(JSON.parse(text));
    expect(valid(value)).toBe(true);
    for (const runAttempt of [1, '0', '01', '9007199254740992', '1e2', ' 1']) {
      const bad = { ...value, locator: { ...value.locator, runAttempt } };
      expect(bodyReceiptSchema.safeParse(bad).success).toBe(false); expect(valid(bad)).toBe(false);
    }
  });
  it('[REQ-470] 未知JSON欄と各階層のown __proto__を保ち共有prototypeを変えない', async () => {
    const { bodyReceiptSchema } = await loadSummarySchemas();
    const value = receiptFixture().receipt;
    Object.defineProperty(value, '__proto__', { value: { future: true }, enumerable: true });
    Object.defineProperty(value.body, '__proto__', { value: { future: 42 }, enumerable: true });
    value.future = { constructor: 'unknown', prototype: null };
    const parsed = bodyReceiptSchema.parse(value);
    expect(Object.hasOwn(parsed, '__proto__')).toBe(true); expect(Object.hasOwn(parsed.body, '__proto__')).toBe(true);
    expect(parsed.future).toEqual(value.future); expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).future).toBeUndefined();
  });
});
