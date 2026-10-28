import { describe, it, expect, expectTypeOf } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { loadVerifyResultSchemas, VERIFY_RESULT_SCHEMA_VERSION, type VerifyResult, type VerifyCheckResult, type VerifyMode } from '../src/index.js';

const { verifyResultSchema } = await loadVerifyResultSchemas();

const valid = {
  schemaVersion: VERIFY_RESULT_SCHEMA_VERSION,
  mode: 'done',
  change: 'add-x',
  ok: true,
  results: [{ check: 'tasks.md の存在', status: 'pass', detail: '' }],
  coverage: { 'REQ-001': ['tests/a.test.ts'], 'REQ-002': [] },
};

describe('verify 結果の Zod スキーマ', () => {
  it('[REQ-274] いまの verify 結果を受け付ける', () => {
    expect(verifyResultSchema.safeParse(valid).success).toBe(true);
    expect(verifyResultSchema.safeParse({ ...valid, mode: 'spec-only', change: null, coverage: undefined }).success).toBe(true);
  });

  it('[REQ-274] 形の違う verify 結果を拒否する', () => {
    const withoutOk: Record<string, unknown> = { ...valid };
    delete withoutOk.ok;
    expect(verifyResultSchema.safeParse(withoutOk).success).toBe(false);
    expect(verifyResultSchema.safeParse({ ...valid, results: [{ check: 'x', status: 'error', detail: '' }] }).success).toBe(false);
    expect(verifyResultSchema.safeParse({ ...valid, schemaVersion: '2.0.0' }).success).toBe(false);
    expect(verifyResultSchema.safeParse({ ...valid, coverage: { 'TASK-1': [] } }).success).toBe(false);
  });

  it('[REQ-274] 型はスキーマから導出し、手書きの型を別に定義しない', () => {
    expectTypeOf<VerifyResult>().toEqualTypeOf<z.infer<typeof verifyResultSchema>>();
    expectTypeOf<VerifyCheckResult>().toEqualTypeOf<VerifyResult['results'][number]>();
    expectTypeOf<VerifyMode>().toEqualTypeOf<VerifyResult['mode']>();
    for (const file of ['verify-result.ts', 'verify-result-schema.ts']) {
      expect(readFileSync(join(import.meta.dirname, '..', 'src', file), 'utf8')).not.toMatch(/export type \w+ = \{/);
    }
  });

  it('[REQ-275] 未知のフィールドを拒否せず、値を変えずに残す', () => {
    const input = { ...valid, extra: { nested: [1, 2] }, results: [{ ...valid.results[0], hint: '次の手順' }] };
    const parsed = verifyResultSchema.parse(input);
    expect(parsed.extra).toEqual({ nested: [1, 2] });
    expect(parsed.results[0].hint).toBe('次の手順');
    expect(parsed).toEqual(input);
  });
});
