import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

it('[REQ-470] 受入済み13Schemaの原文ハッシュを保つ', () => {
  const expected = {
  "evidence.schema.json": "826114281f0fdaa509fd7ea55f4cdcad90690af65b8663e7fdf1734c154a63a4",
  "quality-report.schema.json": "ff3abde48b5e4d1ac5b70efd69d98633eac7422755a40b662b547f20d6462c44",
  "quality.schema.json": "bc650d8da6a4037045b6ddc851b1d12679474ffb708698920574c78c722416a2",
  "report.schema.json": "ec6af2bf1d26981c0755311de190e7a205e379a78a9e072c4ac26fca881a4b35",
  "spec.schema.json": "f42717930be8bdef81a320c29257af68ee724e074df726e6d4526a3290bc6d24",
  "summary/evidence-summary-1.schema.json": "d105e61c59035c84aabf42060bad5f1fb95cdf96d0ffe9ce40372657fe3fad10",
  "tasks.schema.json": "db371161b4940fdd1871b1e43d3830307680188e6e3ab49061664b988fa5e11a",
  "trace.schema.json": "415f1b539e661bc50179ba777507bb0851dc252929722ea9d570cd9eeda5b9c9",
  "verify-result.schema.json": "f4329ae73aba5d6d49f029bf9cbe2cd544e1f62d97724a48b55c3844c497e4e3",
  "versions/evidence-1.schema.json": "47720059568f3aa7a3b00f1ce1bd9e7584d5926380812b665213620c386e0e38",
  "versions/evidence-2.schema.json": "afcee79e996f20892af99c67a4d4a119f04ba07c307b959c3c27e01d12a23a7d",
  "versions/verify-result-1.0.0.schema.json": "dba79f8c941c15dc8636061f4b4cfc34ca7946f3ffe7fcf127af2cf6e0350ba6",
  "versions/verify-result-2.0.0.schema.json": "a81e35fffa3cfcc29f6007c05109fb30c6a7abd016e7bbe18f1def8a519e49d7"
};
  expect(Object.keys(expected)).toHaveLength(13);
  for (const [file, hash] of Object.entries(expected)) {
    const text = readFileSync(join(import.meta.dirname, '../schema', file), 'utf8').replace(/\r\n/g, '\n');
    expect(createHash('sha256').update(text).digest('hex'), file).toBe(hash);
  }
});
